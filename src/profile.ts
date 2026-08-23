import {
  supabase
} from "./data";

import {
  requireAuthenticatedUser
} from "./auth";

import {
  createError,
  normalizeError
} from "./errors";

import {
  getCurrentIdentity,
  getProfileById,
  getHandleByUserId,
  updateOwnProfile,
  type BeanIdentity,
  type BeanProfile,
  type BeanProfileType
} from "./identity";


/* ============================================================
   BEAN — SIGNATURESI
   Profile Module

   Responsibilities:
   - Provide profile-level domain objects
   - Read current/public Bean profiles
   - Update safe profile information
   - Upload/remove profile avatars
   - Generate avatar URLs
   - Keep profile presentation separate from identity

   Must NOT own:
   - Authentication
   - Bean ID creation/rename
   - Messaging
   - Discovery ranking
   - Work/service listings
   - UI rendering
   - Password/account settings

   Identity rule:
   Internal identity  -> immutable UUID
   Public identity    -> bean@username
   ============================================================ */


/* ============================================================
   STORAGE
   ============================================================ */

const AVATAR_BUCKET =
  "bean-avatars";

const MAX_AVATAR_BYTES =
  5 * 1024 * 1024;


/* ============================================================
   AVATAR TYPES
   ============================================================ */

const ALLOWED_AVATAR_TYPES =
  new Set<string>([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);


/* ============================================================
   PUBLIC PROFILE
   ============================================================ */

export interface PublicBeanProfile {
  id: string;

  username: string | null;

  beanId: string | null;

  displayName: string;

  bio: string;

  avatarUrl: string | null;

  profileType: BeanProfileType;

  city: string | null;

  countryCode: string | null;

  isAvailableForWork: boolean;
}


/* ============================================================
   OWN PROFILE
   ============================================================ */

export interface OwnBeanProfile
  extends PublicBeanProfile {
  avatarPath: string | null;

  isDiscoverable: boolean;

  createdAt: string;

  updatedAt: string;
}


/* ============================================================
   UPDATE INPUT
   ============================================================ */

export interface UpdateBeanProfileInput {
  displayName?: string;

  bio?: string;

  profileType?: BeanProfileType;

  city?: string | null;

  countryCode?: string | null;

  isDiscoverable?: boolean;

  isAvailableForWork?: boolean;
}


/* ============================================================
   AVATAR INPUT
   ============================================================ */

export interface UploadAvatarInput {
  file: File;
}


/* ============================================================
   AVATAR URL
   ============================================================ */

export function getAvatarUrl(
  avatarPath: string | null
): string | null {
  if (!avatarPath) {
    return null;
  }


  const {
    data
  } =
    supabase.storage
      .from(
        AVATAR_BUCKET
      )
      .getPublicUrl(
        avatarPath
      );


  return (
    data.publicUrl ||
    null
  );
}


/* ============================================================
   PROFILE MAPPERS
   ============================================================ */

function mapPublicProfile(
  profile: BeanProfile,
  username: string | null,
  beanId: string | null
): PublicBeanProfile {
  return {
    id:
      profile.id,

    username,

    beanId,

    displayName:
      profile.displayName,

    bio:
      profile.bio,

    avatarUrl:
      getAvatarUrl(
        profile.avatarPath
      ),

    profileType:
      profile.profileType,

    city:
      profile.city,

    countryCode:
      profile.countryCode,

    isAvailableForWork:
      profile.isAvailableForWork
  };
}


function mapOwnProfile(
  identity: BeanIdentity
): OwnBeanProfile {
  return {
    ...mapPublicProfile(
      identity.profile,
      identity.username,
      identity.beanId
    ),

    avatarPath:
      identity.profile.avatarPath,

    isDiscoverable:
      identity.profile
        .isDiscoverable,

    createdAt:
      identity.profile.createdAt,

    updatedAt:
      identity.profile.updatedAt
  };
}


/* ============================================================
   CURRENT PROFILE
   ============================================================ */

export async function getOwnProfile():
  Promise<OwnBeanProfile | null> {
  requireAuthenticatedUser();


  const identity =
    await getCurrentIdentity();


  if (!identity) {
    return null;
  }


  return mapOwnProfile(
    identity
  );
}


/* ============================================================
   PUBLIC PROFILE BY UUID
   ============================================================ */

export async function getPublicProfileById(
  userId: string
): Promise<PublicBeanProfile | null> {
  requireAuthenticatedUser();


  try {
    const [
      profile,
      handle
    ] =
      await Promise.all([
        getProfileById(
          userId
        ),

        getHandleByUserId(
          userId
        )
      ]);


    if (!profile) {
      return null;
    }


    /*
     * Public/direct profile access rules are ultimately
     * enforced by Supabase RLS.
     *
     * Non-discoverable does not necessarily mean invisible
     * to an existing conversation participant.
     */
    return mapPublicProfile(
      profile,
      handle?.username ??
        null,
      handle?.beanId ??
        null
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "profile",

        fallbackCode:
          "IDENTITY_NOT_FOUND",

        context: {
          operation:
            "getPublicProfileById",

          userId
        }
      }
    );
  }
}


/* ============================================================
   PROFILE UPDATE

   Bean ID is intentionally absent.
   Identity rename is NOT a profile edit.
   ============================================================ */

export async function updateProfile(
  input: UpdateBeanProfileInput
): Promise<OwnBeanProfile> {
  const account =
    requireAuthenticatedUser();


  await updateOwnProfile(
    input
  );


  const identity =
    await getCurrentIdentity();


  if (!identity) {
    throw createError(
      "IDENTITY_NOT_FOUND",
      "profile",
      {
        context: {
          userId:
            account.id
        }
      }
    );
  }


  return mapOwnProfile(
    identity
  );
}


/* ============================================================
   AVATAR VALIDATION
   ============================================================ */

function validateAvatar(
  file: File
): void {
  if (
    !(file instanceof File)
  ) {
    throw createError(
      "MEDIA_INVALID_FILE",
      "profile"
    );
  }


  if (
    file.size <= 0
  ) {
    throw createError(
      "MEDIA_INVALID_FILE",
      "profile",
      {
        message:
          "Avatar file is empty."
      }
    );
  }


  if (
    file.size >
      MAX_AVATAR_BYTES
  ) {
    throw createError(
      "MEDIA_FILE_TOO_LARGE",
      "profile",
      {
        context: {
          size:
            file.size,

          limit:
            MAX_AVATAR_BYTES
        }
      }
    );
  }


  if (
    !ALLOWED_AVATAR_TYPES.has(
      file.type
    )
  ) {
    throw createError(
      "MEDIA_INVALID_FILE",
      "profile",
      {
        message:
          "Avatar must be JPEG, PNG or WebP."
      }
    );
  }
}


/* ============================================================
   EXTENSION
   ============================================================ */

function getAvatarExtension(
  mimeType: string
): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    default:
      throw createError(
        "MEDIA_INVALID_FILE",
        "profile"
      );
  }
}


/* ============================================================
   AVATAR STORAGE PATH

   Never use:
   - display name
   - username
   - bean@username
   - original filename

   Example:
   users/<UUID>/avatar/<UUID>.webp
   ============================================================ */

function createAvatarPath(
  userId: string,
  extension: string
): string {
  if (
    typeof crypto.randomUUID !==
      "function"
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "profile",
      {
        message:
          "Secure UUID generation is unavailable."
      }
    );
  }


  const objectId =
    crypto.randomUUID();


  return [
    "users",
    userId,
    "avatar",
    `${objectId}.${extension}`
  ].join("/");
}


/* ============================================================
   UPLOAD AVATAR

   Flow:
   validate
      ↓
   upload new object
      ↓
   update profile row
      ↓
   delete old avatar

   Old avatar stays intact if the new upload/profile update
   fails.
   ============================================================ */

export async function uploadAvatar(
  input: UploadAvatarInput
): Promise<OwnBeanProfile> {
  const account =
    requireAuthenticatedUser();


  validateAvatar(
    input.file
  );


  const currentProfile =
    await getOwnProfile();


  if (!currentProfile) {
    throw createError(
      "IDENTITY_NOT_FOUND",
      "profile"
    );
  }


  const extension =
    getAvatarExtension(
      input.file.type
    );


  const storagePath =
    createAvatarPath(
      account.id,
      extension
    );


  /* ========================================================
     UPLOAD NEW AVATAR
     ======================================================== */

  try {
    const {
      error
    } =
      await supabase.storage
        .from(
          AVATAR_BUCKET
        )
        .upload(
          storagePath,
          input.file,
          {
            contentType:
              input.file.type,

            cacheControl:
              "3600",

            upsert:
              false
          }
        );


    if (error) {
      throw error;
    }
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "profile",

        fallbackCode:
          "MEDIA_UPLOAD_FAILED",

        context: {
          operation:
            "uploadAvatar.storage",

          userId:
            account.id
        }
      }
    );
  }


  /* ========================================================
     ATTACH AVATAR TO PROFILE
     ======================================================== */

  try {
    await updateOwnProfile({
      avatarPath:
        storagePath
    });
  } catch (error) {
    /*
     * Profile update failed.
     * Remove newly uploaded orphan object.
     */
    try {
      await supabase.storage
        .from(
          AVATAR_BUCKET
        )
        .remove([
          storagePath
        ]);
    } catch {
      // Cleanup can be retried later.
    }


    throw normalizeError(
      error,
      {
        source:
          "profile",

        fallbackCode:
          "MEDIA_UPLOAD_FAILED",

        context: {
          operation:
            "uploadAvatar.profile",

          userId:
            account.id
        }
      }
    );
  }


  /* ========================================================
     REMOVE OLD AVATAR

     Do this only after profile points to the new one.
     ======================================================== */

  if (
    currentProfile.avatarPath &&
    currentProfile.avatarPath !==
      storagePath
  ) {
    try {
      await supabase.storage
        .from(
          AVATAR_BUCKET
        )
        .remove([
          currentProfile
            .avatarPath
        ]);
    } catch (error) {
      console.warn(
        "[Bean:profile] Old avatar cleanup failed.",
        error
      );
    }
  }


  const updated =
    await getOwnProfile();


  if (!updated) {
    throw createError(
      "IDENTITY_NOT_FOUND",
      "profile"
    );
  }


  return updated;
}


/* ============================================================
   REMOVE AVATAR
   ============================================================ */

export async function removeAvatar():
  Promise<OwnBeanProfile> {
  requireAuthenticatedUser();


  const current =
    await getOwnProfile();


  if (!current) {
    throw createError(
      "IDENTITY_NOT_FOUND",
      "profile"
    );
  }


  if (
    !current.avatarPath
  ) {
    return current;
  }


  const oldPath =
    current.avatarPath;


  /*
   * Remove database reference first.

   * If Storage deletion fails, the object becomes an orphan
   * but the user profile no longer exposes it.
   */
  await updateOwnProfile({
    avatarPath:
      null
  });


  try {
    const {
      error
    } =
      await supabase.storage
        .from(
          AVATAR_BUCKET
        )
        .remove([
          oldPath
        ]);


    if (error) {
      throw error;
    }
  } catch (error) {
    console.warn(
      "[Bean:profile] Avatar physical cleanup failed.",
      normalizeError(
        error,
        {
          source:
            "profile",

          context: {
            operation:
              "removeAvatar.storage",

            storagePath:
              oldPath
          }
        }
      )
    );
  }


  const updated =
    await getOwnProfile();


  if (!updated) {
    throw createError(
      "IDENTITY_NOT_FOUND",
      "profile"
    );
  }


  return updated;
}


/* ============================================================
   PROFILE TYPE
   ============================================================ */

export function isProfessionalProfile(
  profile:
    PublicBeanProfile
): boolean {
  return (
    profile.profileType ===
      "professional" ||
    profile.profileType ===
      "business" ||
    profile.profileType ===
      "creator"
  );
}


/* ============================================================
   PROFILE COMPLETENESS

   Used later by UI / onboarding.

   This is not a trust/security score.
   ============================================================ */

export function getProfileCompleteness(
  profile:
    OwnBeanProfile
): number {
  const checks = [
    profile.displayName
      .trim()
      .length > 0,

    profile.beanId !==
      null,

    profile.bio
      .trim()
      .length > 0,

    profile.avatarPath !==
      null,

    profile.countryCode !==
      null
  ];


  const completed =
    checks.filter(
      Boolean
    ).length;


  return Math.round(
    (
      completed /
      checks.length
    ) *
      100
  );
}


/* ============================================================
   LIMIT HELPERS
   ============================================================ */

export function getMaximumAvatarSize():
  number {
  return MAX_AVATAR_BYTES;
}


export function isAvatarTypeAllowed(
  mimeType: string
): boolean {
  return ALLOWED_AVATAR_TYPES.has(
    mimeType
  );
}
