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

   Responsibilities:
   - Bridge Signaturesi account UUID to Bean identity
   - Read/create the current Bean profile
   - Claim the user's initial Bean ID
   - Resolve an exact Bean ID to a user
   - Normalize Bean ID input consistently
   - Update safe profile fields

   Must NOT own:
   - Authentication/session management
   - Passwords
   - Bean ID rename workflow
   - Messaging
   - Business discovery ranking
   - Profile UI
   - Payments
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 20;


const HANDLE_PATTERN =
  /^[a-z0-9_]+$/;


const RESERVED_HANDLES =
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

  handle: string;

  createdAt: string;
}


export interface BeanIdentity {
  id: string;

  handle: string | null;

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
   Temporary hand-written types.

   Later, after the final Supabase schema is locked,
   generated database types can replace these.
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
   NORMALIZATION
   ============================================================ */

/**
 * Accepts common Signaturesi / legacy forms:
 *
 *   samuel
 *   @samuel
 *   samuel@bean
 *
 * and normalizes all of them to:
 *
 *   samuel
 */
export function normalizeHandle(
  value: string
): string {
  let handle =
    value
      .trim()
      .toLowerCase();


  if (
    handle.startsWith("@")
  ) {
    handle =
      handle.slice(1);
  }


  if (
    handle.endsWith("@bean")
  ) {
    handle =
      handle.slice(
        0,
        -5
      );
  }


  return handle.trim();
}


/**
 * Public display format.
 */
export function formatBeanId(
  handle: string
): string {
  return `@${handle}`;
}


/**
 * Legacy-compatible representation.
 *
 * This exists only for migration/interoperability.
 * New Bean internals must not depend on it.
 */
export function formatLegacyBeanId(
  handle: string
): string {
  return `${handle}@bean`;
}


/* ============================================================
   HANDLE VALIDATION
   ============================================================ */

export function validateHandle(
  rawHandle: string
): string {
  const handle =
    normalizeHandle(
      rawHandle
    );


  if (
    handle.length <
      HANDLE_MIN_LENGTH ||
    handle.length >
      HANDLE_MAX_LENGTH
  ) {
    throw createError(
      "HANDLE_INVALID",
      "identity",
      {
        message:
          `Bean ID must contain ${HANDLE_MIN_LENGTH}-${HANDLE_MAX_LENGTH} characters.`
      }
    );
  }


  if (
    !HANDLE_PATTERN.test(
      handle
    )
  ) {
    throw createError(
      "HANDLE_INVALID",
      "identity",
      {
        message:
          "Bean ID may contain lowercase letters, numbers and underscores only."
      }
    );
  }


  if (
    RESERVED_HANDLES.has(
      handle
    )
  ) {
    throw createError(
      "HANDLE_RESERVED",
      "identity"
    );
  }


  return handle;
}


/* ============================================================
   ROW MAPPERS
   Database naming never leaks into feature/UI modules.
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

    handle:
      row.handle,

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
        .from("bean_user_profiles")
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
   HANDLE READ
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
        .from("bean_user_handles")
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
   EXACT HANDLE LOOKUP
   Used by New Message / exact Bean ID navigation.

   Discovery/search ranking belongs to discovery.ts later.
   ============================================================ */

export async function resolveHandle(
  rawHandle: string
): Promise<BeanIdentity | null> {
  const handle =
    validateHandle(
      rawHandle
    );


  try {
    const {
      data: handleRow,
      error: handleError
    } =
      await supabase
        .from("bean_user_handles")
        .select(
          `
            user_id,
            handle,
            created_at
          `
        )
        .eq(
          "handle",
          handle
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

      handle:
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
            "resolveHandle",

          handle
        }
      }
    );
  }
}


/* ============================================================
   HANDLE AVAILABILITY
   ============================================================ */

export async function isHandleAvailable(
  rawHandle: string
): Promise<boolean> {
  const handle =
    validateHandle(
      rawHandle
    );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from("bean_user_handles")
        .select(
          "user_id"
        )
        .eq(
          "handle",
          handle
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
            "isHandleAvailable",

          handle
        }
      }
    );
  }
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
        .from("bean_user_profiles")
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
     * Another tab/device may have created the row
     * between our initial read and insert.
     *
     * Re-read before treating it as a fatal failure.
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
   HANDLE CLAIM
   Initial claim only.

   Rename is intentionally NOT implemented here.
   Handle changes later require a trusted server workflow,
   cooldown, aliases/history and abuse protection.
   ============================================================ */

export async function claimInitialHandle(
  rawHandle: string
): Promise<BeanHandle> {
  const account =
    requireAuthenticatedUser();


  const handle =
    validateHandle(
      rawHandle
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
        .from("bean_user_handles")
        .insert({
          user_id:
            account.id,

          handle
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
      /*
       * Unique handle violation.
       */
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
              handle
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
            "claimInitialHandle",

          handle
        }
      }
    );
  }
}


/* ============================================================
   CENTRAL SIGNATURESI BEAN ID CANDIDATE

   Signaturesi Accounts is the source of account identity.

   If it already supplies a Bean ID, we use that as the
   initial claim candidate.

   This does NOT silently override an existing Bean handle.
   ============================================================ */

function getCentralHandleCandidate():
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
      return validateHandle(
        candidate
      );
    } catch {
      /*
       * Try the next candidate.
       */
    }
  }


  return null;
}


/* ============================================================
   ENSURE CURRENT IDENTITY

   Called after auth restoration.

   Safe sequence:
   1. Verify authenticated UUID
   2. Ensure Bean profile exists
   3. Read existing Bean handle
   4. If missing, try central Signaturesi Bean ID
   5. Return stable identity
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
      getCentralHandleCandidate();


    if (candidate) {
      try {
        handle =
          await claimInitialHandle(
            candidate
          );
      } catch (error) {
        /*
         * A central/legacy Bean ID may already exist in the
         * migration dataset.

         * We do NOT automatically invent another identity.
         * Account-claim migration will resolve ownership.
         */
        const normalized =
          normalizeError(
            error,
            {
              source:
                "identity"
            }
          );


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

    handle:
      handle?.handle ??
      null,

    beanId:
      handle
        ? formatBeanId(
            handle.handle
          )
        : null,

    profile
  };
}


/* ============================================================
   CURRENT IDENTITY
   Read-only; does not create anything.
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

    handle:
      handle?.handle ??
      null,

    beanId:
      handle
        ? formatBeanId(
            handle.handle
          )
        : null,

    profile
  };
}


/* ============================================================
   PROFILE UPDATE
   Only safe self-owned profile fields.
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
    input.bio !== undefined
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


  /*
   * Nothing to update.
   */
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
        .from("bean_user_profiles")
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
