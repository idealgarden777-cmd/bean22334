import {
  supabase
} from "./data";

import {
  getCurrentUser,
  requireAuthenticatedUser
} from "./auth";

import {
  createError,
  normalizeError
} from "./errors";


/* ============================================================
   BEAN — SIGNATURESI
   Identity Module

   Canonical public identity:
   bean@username

   Permanent internal identity:
   UUID

   Responsibilities:
   - Bridge Signaturesi UUID to Bean public identity
   - Read/create Bean profile
   - Read/claim canonical Bean ID
   - Normalize legacy identity formats
   - Resolve exact Bean IDs
   - Update safe profile fields

   Must NOT own:
   - Authentication/session lifecycle
   - Passwords
   - Bean ID rename workflow
   - Messaging
   - Discovery ranking
   - Profile UI
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

const USERNAME_PATTERN =
  /^[a-z0-9_]+$/;

const CANONICAL_PREFIX =
  "bean@";

const LEGACY_SUFFIX =
  "@bean";

const RESERVED_USERNAMES =
  new Set<string>([
    "admin",
    "administrator",
    "support",
    "security",
    "system",
    "root",
    "bean",
    "signaturesi"
  ]);


/* ============================================================
   TYPES
   ============================================================ */

export type BeanProfileType =
  | "personal"
  | "professional"
  | "business"
  | "creator";


export interface BeanProfile {
  id: string;

  displayName: string;

  bio: string;

  avatarPath: string | null;

  profileType: BeanProfileType;

  city: string | null;

  countryCode: string | null;

  isDiscoverable: boolean;

  isAvailableForWork: boolean;

  createdAt: string;

  updatedAt: string;
}


export interface BeanHandle {
  userId: string;

  username: string;

  beanId: string;

  createdAt: string;
}


export interface BeanIdentity {
  id: string;

  username: string | null;

  beanId: string | null;

  profile: BeanProfile;
}


export interface UpdateProfileInput {
  displayName?: string;

  bio?: string;

  avatarPath?: string | null;

  profileType?: BeanProfileType;

  city?: string | null;

  countryCode?: string | null;

  isDiscoverable?: boolean;

  isAvailableForWork?: boolean;
}


/* ============================================================
   DATABASE ROW TYPES

   Database stores only normalized username:
   samuel

   Public UI derives:
   bean@samuel
   ============================================================ */

interface ProfileRow {
  id: string;

  display_name: string;

  bio: string;

  avatar_path: string | null;

  profile_type: BeanProfileType;

  city: string | null;

  country_code: string | null;

  is_discoverable: boolean;

  is_available_for_work: boolean;

  created_at: string;

  updated_at: string;
}


interface HandleRow {
  user_id: string;

  handle: string;

  created_at: string;
}


/* ============================================================
   IDENTITY NORMALIZATION

   Accepted migration/input forms:

   samuel
   @samuel
   samuel@bean
   bean@samuel

   Canonical username:
   samuel

   Canonical public Bean ID:
   bean@samuel
   ============================================================ */

export function normalizeUsername(
  value: string
): string {
  let result =
    value
      .trim()
      .toLowerCase();


  if (
    result.startsWith(
      CANONICAL_PREFIX
    )
  ) {
    result =
      result.slice(
        CANONICAL_PREFIX.length
      );
  }


  if (
    result.startsWith("@")
  ) {
    result =
      result.slice(1);
  }


  if (
    result.endsWith(
      LEGACY_SUFFIX
    )
  ) {
    result =
      result.slice(
        0,
        -LEGACY_SUFFIX.length
      );
  }


  return result.trim();
}


/**
 * Canonical Signaturesi ecosystem identity.
 *
 * Example:
 *   samuel -> bean@samuel
 */
export function formatBeanId(
  username: string
): string {
  return `${CANONICAL_PREFIX}${username}`;
}


/**
 * Legacy migration representation only.
 *
 * New Bean features must never use this as
 * canonical identity.
 */
export function formatLegacyBeanId(
  username: string
): string {
  return `${username}${LEGACY_SUFFIX}`;
}


/* ============================================================
   VALIDATION
   ============================================================ */

export function validateUsername(
  rawValue: string
): string {
  const username =
    normalizeUsername(
      rawValue
    );


  if (
    username.length <
      USERNAME_MIN_LENGTH ||
    username.length >
      USERNAME_MAX_LENGTH
  ) {
    throw createError(
      "HANDLE_INVALID",
      "identity",
      {
        message:
          `Bean username must contain ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`
      }
    );
  }


  if (
    !USERNAME_PATTERN.test(
      username
    )
  ) {
    throw createError(
      "HANDLE_INVALID",
      "identity",
      {
        message:
          "Bean username may contain lowercase letters, numbers and underscores only."
      }
    );
  }


  if (
    RESERVED_USERNAMES.has(
      username
    )
  ) {
    throw createError(
      "HANDLE_RESERVED",
      "identity"
    );
  }


  return username;
}


/**
 * Alias retained for feature modules that think
 * in terms of handles rather than usernames.
 */
export function validateHandle(
  rawValue: string
): string {
  return validateUsername(
    rawValue
  );
}


/* ============================================================
   ROW MAPPERS
   ============================================================ */

function mapProfile(
  row: ProfileRow
): BeanProfile {
  return {
    id:
      row.id,

    displayName:
      row.display_name,

    bio:
      row.bio,

    avatarPath:
      row.avatar_path,

    profileType:
      row.profile_type,

    city:
      row.city,

    countryCode:
      row.country_code,

    isDiscoverable:
      row.is_discoverable,

    isAvailableForWork:
      row.is_available_for_work,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function mapHandle(
  row: HandleRow
): BeanHandle {
  return {
    userId:
      row.user_id,

    username:
      row.handle,

    beanId:
      formatBeanId(
        row.handle
      ),

    createdAt:
      row.created_at
  };
}


/* ============================================================
   PROFILE READ
   ============================================================ */

export async function getProfileById(
  userId: string
): Promise<BeanProfile | null> {
  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_user_profiles"
        )
        .select(
          `
            id,
            display_name,
            bio,
            avatar_path,
            profile_type,
            city,
            country_code,
            is_discoverable,
            is_available_for_work,
            created_at,
            updated_at
          `
        )
        .eq(
          "id",
          userId
        )
        .maybeSingle<ProfileRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapProfile(data)
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "identity",

        fallbackCode:
          "IDENTITY_NOT_FOUND",

        context: {
          operation:
            "getProfileById",

          userId
        }
      }
    );
  }
}


/* ============================================================
   HANDLE READ BY UUID
   ============================================================ */

export async function getHandleByUserId(
  userId: string
): Promise<BeanHandle | null> {
  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_user_handles"
        )
        .select(
          `
            user_id,
            handle,
            created_at
          `
        )
        .eq(
          "user_id",
          userId
        )
        .maybeSingle<HandleRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapHandle(data)
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "identity",

        fallbackCode:
          "IDENTITY_NOT_FOUND",

        context: {
          operation:
            "getHandleByUserId",

          userId
        }
      }
    );
  }
}


/* ============================================================
   EXACT BEAN ID RESOLUTION

   Accepted:
   bean@samuel
   samuel
   legacy samuel@bean

   Returned identity always uses:
   bean@samuel
   ============================================================ */

export async function resolveBeanId(
  rawBeanId: string
): Promise<BeanIdentity | null> {
  const username =
    validateUsername(
      rawBeanId
    );


  try {
    const {
      data: handleRow,
      error: handleError
    } =
      await supabase
        .from(
          "bean_user_handles"
        )
        .select(
          `
            user_id,
            handle,
            created_at
          `
        )
        .eq(
          "handle",
          username
        )
        .maybeSingle<HandleRow>();


    if (handleError) {
      throw handleError;
    }


    if (!handleRow) {
      return null;
    }


    const profile =
      await getProfileById(
        handleRow.user_id
      );


    if (!profile) {
      return null;
    }


    return {
      id:
        profile.id,

      username:
        handleRow.handle,

      beanId:
        formatBeanId(
          handleRow.handle
        ),

      profile
    };
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "identity",

        fallbackCode:
          "IDENTITY_NOT_FOUND",

        context: {
          operation:
            "resolveBeanId",

          username
        }
      }
    );
  }
}


/**
 * Compatibility alias.
 */
export async function resolveHandle(
  value: string
): Promise<BeanIdentity | null> {
  return resolveBeanId(
    value
  );
}


/* ============================================================
   AVAILABILITY
   ============================================================ */

export async function isBeanIdAvailable(
  rawBeanId: string
): Promise<boolean> {
  const username =
    validateUsername(
      rawBeanId
    );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_user_handles"
        )
        .select(
          "user_id"
        )
        .eq(
          "handle",
          username
        )
        .limit(1);


    if (error) {
      throw error;
    }


    return (
      !data ||
      data.length === 0
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "identity",

        context: {
          operation:
            "isBeanIdAvailable",

          username
        }
      }
    );
  }
}


export async function isHandleAvailable(
  rawValue: string
): Promise<boolean> {
  return isBeanIdAvailable(
    rawValue
  );
}


/* ============================================================
   PROFILE CREATION
   ============================================================ */

async function createOwnProfile():
  Promise<BeanProfile> {
  const account =
    requireAuthenticatedUser();


  const displayName =
    account.displayName.trim() ||
    account.username.trim() ||
    "Bean User";


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_user_profiles"
        )
        .insert({
          id:
            account.id,

          display_name:
            displayName,

          bio:
            "",

          profile_type:
            "personal",

          is_discoverable:
            true,

          is_available_for_work:
            false
        })
        .select(
          `
            id,
            display_name,
            bio,
            avatar_path,
            profile_type,
            city,
            country_code,
            is_discoverable,
            is_available_for_work,
            created_at,
            updated_at
          `
        )
        .single<ProfileRow>();


    if (error) {
      throw error;
    }


    return mapProfile(
      data
    );
  } catch (error) {
    /*
     * Another tab/device may have created the
     * profile between our read and insert.
     */
    const existing =
      await getProfileById(
        account.id
      );


    if (existing) {
      return existing;
    }


    throw normalizeError(
      error,
      {
        source:
          "identity",

        context: {
          operation:
            "createOwnProfile",

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   INITIAL BEAN ID CLAIM

   Only initial claim is allowed from the browser.

   Rename remains a trusted server operation later.
   ============================================================ */

export async function claimInitialBeanId(
  rawBeanId: string
): Promise<BeanHandle> {
  const account =
    requireAuthenticatedUser();


  const username =
    validateUsername(
      rawBeanId
    );


  const existing =
    await getHandleByUserId(
      account.id
    );


  if (existing) {
    return existing;
  }


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_user_handles"
        )
        .insert({
          user_id:
            account.id,

          handle:
            username
        })
        .select(
          `
            user_id,
            handle,
            created_at
          `
        )
        .single<HandleRow>();


    if (error) {
      if (
        error.code ===
          "23505"
      ) {
        throw createError(
          "HANDLE_TAKEN",
          "identity",
          {
            cause:
              error,

            context: {
              beanId:
                formatBeanId(
                  username
                )
            }
          }
        );
      }


      throw error;
    }


    return mapHandle(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "identity",

        fallbackCode:
          "HANDLE_TAKEN",

        context: {
          operation:
            "claimInitialBeanId",

          username
        }
      }
    );
  }
}


/**
 * Compatibility alias.
 */
export async function claimInitialHandle(
  rawValue: string
): Promise<BeanHandle> {
  return claimInitialBeanId(
    rawValue
  );
}


/* ============================================================
   CENTRAL SIGNATURESI ID CANDIDATE

   Neyo / Accounts may already supply:
   bean@samuel

   If not, username can be used to derive:
   bean@samuel
   ============================================================ */

function getCentralUsernameCandidate():
  string | null {
  const account =
    getCurrentUser();


  if (!account) {
    return null;
  }


  const candidates = [
    account.beanId,
    account.username
  ];


  for (
    const candidate of candidates
  ) {
    if (!candidate) {
      continue;
    }


    try {
      return validateUsername(
        candidate
      );
    } catch {
      // Try next candidate.
    }
  }


  return null;
}


/* ============================================================
   ENSURE CURRENT IDENTITY

   Safe order:

   Signaturesi Auth UUID
           ↓
   Bean profile
           ↓
   existing Bean ID
           ↓
   central Neyo/Accounts Bean ID
           ↓
   bean@username
   ============================================================ */

export async function ensureCurrentIdentity():
  Promise<BeanIdentity> {
  const account =
    requireAuthenticatedUser();


  let profile =
    await getProfileById(
      account.id
    );


  if (!profile) {
    profile =
      await createOwnProfile();
  }


  let handle =
    await getHandleByUserId(
      account.id
    );


  if (!handle) {
    const candidate =
      getCentralUsernameCandidate();


    if (candidate) {
      try {
        handle =
          await claimInitialBeanId(
            candidate
          );
      } catch (error) {
        const normalized =
          normalizeError(
            error,
            {
              source:
                "identity"
            }
          );


        /*
         * Existing legacy/Neyo ownership may need
         * account-claim migration.
         *
         * Never invent a replacement Bean ID.
         */
        if (
          normalized.code !==
            "HANDLE_TAKEN"
        ) {
          throw normalized;
        }
      }
    }
  }


  return {
    id:
      account.id,

    username:
      handle?.username ??
      null,

    beanId:
      handle?.beanId ??
      null,

    profile
  };
}


/* ============================================================
   CURRENT IDENTITY
   Read-only. Creates nothing.
   ============================================================ */

export async function getCurrentIdentity():
  Promise<BeanIdentity | null> {
  const account =
    getCurrentUser();


  if (!account) {
    return null;
  }


  const [
    profile,
    handle
  ] =
    await Promise.all([
      getProfileById(
        account.id
      ),

      getHandleByUserId(
        account.id
      )
    ]);


  if (!profile) {
    return null;
  }


  return {
    id:
      account.id,

    username:
      handle?.username ??
      null,

    beanId:
      handle?.beanId ??
      null,

    profile
  };
}


/* ============================================================
   PROFILE UPDATE
   ============================================================ */

export async function updateOwnProfile(
  input: UpdateProfileInput
): Promise<BeanProfile> {
  const account =
    requireAuthenticatedUser();


  const payload:
    Record<string, unknown> = {};


  if (
    input.displayName !==
      undefined
  ) {
    const displayName =
      input.displayName
        .trim()
        .slice(
          0,
          80
        );


    if (!displayName) {
      throw createError(
        "INVALID_INPUT",
        "identity",
        {
          message:
            "Display name cannot be empty."
        }
      );
    }


    payload.display_name =
      displayName;
  }


  if (
    input.bio !==
      undefined
  ) {
    payload.bio =
      input.bio
        .trim()
        .slice(
          0,
          500
        );
  }


  if (
    input.avatarPath !==
      undefined
  ) {
    payload.avatar_path =
      input.avatarPath;
  }


  if (
    input.profileType !==
      undefined
  ) {
    payload.profile_type =
      input.profileType;
  }


  if (
    input.city !==
      undefined
  ) {
    payload.city =
      input.city
        ?.trim()
        .slice(
          0,
          100
        ) ||
      null;
  }


  if (
    input.countryCode !==
      undefined
  ) {
    const countryCode =
      input.countryCode
        ?.trim()
        .toUpperCase() ??
      null;


    if (
      countryCode !== null &&
      !/^[A-Z]{2}$/.test(
        countryCode
      )
    ) {
      throw createError(
        "INVALID_INPUT",
        "identity",
        {
          message:
            "Country code must use ISO two-letter format."
        }
      );
    }


    payload.country_code =
      countryCode;
  }


  if (
    input.isDiscoverable !==
      undefined
  ) {
    payload.is_discoverable =
      input.isDiscoverable;
  }


  if (
    input.isAvailableForWork !==
      undefined
  ) {
    payload.is_available_for_work =
      input.isAvailableForWork;
  }


  if (
    Object.keys(
      payload
    ).length === 0
  ) {
    const existing =
      await getProfileById(
        account.id
      );


    if (!existing) {
      throw createError(
        "IDENTITY_NOT_FOUND",
        "identity"
      );
    }


    return existing;
  }


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_user_profiles"
        )
        .update(
          payload
        )
        .eq(
          "id",
          account.id
        )
        .select(
          `
            id,
            display_name,
            bio,
            avatar_path,
            profile_type,
            city,
            country_code,
            is_discoverable,
            is_available_for_work,
            created_at,
            updated_at
          `
        )
        .single<ProfileRow>();


    if (error) {
      throw error;
    }


    return mapProfile(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "identity",

        context: {
          operation:
            "updateOwnProfile",

          userId:
            account.id
        }
      }
    );
  }
}
