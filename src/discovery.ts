import {
  supabase
} from "./data";

import {
  config
} from "./core";

import {
  requireAuthenticatedUser
} from "./auth";

import {
  createError,
  normalizeError
} from "./errors";

import {
  formatBeanId,
  normalizeUsername,
  type BeanProfileType
} from "./identity";

import {
  getAvatarUrl
} from "./profile";


/* ============================================================
   BEAN — SIGNATURESI
   Discovery Module

   Responsibilities:
   - Search discoverable Bean identities
   - Search by bean@username
   - Search by display name
   - Filter professionals/business/creators
   - Filter by location / availability
   - Return stable discovery result objects
   - Provide pagination

   Must NOT own:
   - Identity creation
   - Bean ID rename
   - Conversations
   - Messaging
   - Hiring/project creation
   - Ranking ML implementation
   - Profile editing
   - UI rendering

   Identity:
   Internal database key -> UUID
   Public identity       -> bean@username
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const DEFAULT_RESULT_LIMIT =
  24;

const MAX_RESULT_LIMIT =
  50;

const MAX_QUERY_LENGTH =
  80;


/* ============================================================
   TYPES
   ============================================================ */

export type DiscoveryProfileType =
  BeanProfileType;


export interface DiscoveryResult {
  userId: string;

  username: string;

  beanId: string;

  displayName: string;

  bio: string;

  avatarUrl: string | null;

  profileType:
    DiscoveryProfileType;

  city: string | null;

  countryCode: string | null;

  isAvailableForWork: boolean;
}


export interface DiscoverySearchInput {
  query?: string;

  profileTypes?:
    DiscoveryProfileType[];

  city?: string;

  countryCode?: string;

  availableForWork?: boolean;

  limit?: number;

  offset?: number;
}


export interface DiscoverySearchResult {
  items:
    DiscoveryResult[];

  offset:
    number;

  limit:
    number;

  hasMore:
    boolean;
}


/* ============================================================
   DATABASE ROW

   Final schema.sql will expose a discovery-safe projection.

   IMPORTANT:
   Search must not expose:
   - email
   - auth metadata
   - private profile fields
   - device information
   - phone numbers
   - crypto keys
   ============================================================ */

interface DiscoveryRow {
  user_id: string;

  handle: string;

  display_name: string;

  bio: string;

  avatar_path: string | null;

  profile_type:
    DiscoveryProfileType;

  city: string | null;

  country_code: string | null;

  is_available_for_work: boolean;
}


/* ============================================================
   FEATURE CHECK
   ============================================================ */

function assertDiscoveryEnabled():
  void {
  if (
    !config.featureDefaults
      .discover
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "discovery",
      {
        message:
          "Bean Discover is currently disabled."
      }
    );
  }
}


/* ============================================================
   NORMALIZE SEARCH QUERY
   ============================================================ */

function normalizeSearchQuery(
  value:
    string | undefined
): string | null {
  if (
    value === undefined
  ) {
    return null;
  }


  const query =
    value
      .trim()
      .slice(
        0,
        MAX_QUERY_LENGTH
      );


  if (!query) {
    return null;
  }


  return query;
}


/* ============================================================
   PAGE LIMIT
   ============================================================ */

function normalizeLimit(
  value:
    number | undefined
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_RESULT_LIMIT;
  }


  return Math.max(
    1,
    Math.min(
      MAX_RESULT_LIMIT,
      Math.floor(value)
    )
  );
}


/* ============================================================
   OFFSET
   ============================================================ */

function normalizeOffset(
  value:
    number | undefined
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return 0;
  }


  return Math.max(
    0,
    Math.floor(value)
  );
}


/* ============================================================
   COUNTRY CODE
   ============================================================ */

function normalizeCountryCode(
  value:
    string | undefined
): string | null {
  if (
    value === undefined
  ) {
    return null;
  }


  const result =
    value
      .trim()
      .toUpperCase();


  if (!result) {
    return null;
  }


  if (
    !/^[A-Z]{2}$/.test(
      result
    )
  ) {
    throw createError(
      "INVALID_INPUT",
      "discovery",
      {
        message:
          "Country code must use ISO two-letter format."
      }
    );
  }


  return result;
}


/* ============================================================
   PROFILE TYPES
   ============================================================ */

function normalizeProfileTypes(
  values:
    DiscoveryProfileType[] |
    undefined
): DiscoveryProfileType[] {
  if (!values) {
    return [];
  }


  const valid =
    new Set<
      DiscoveryProfileType
    >([
      "personal",
      "professional",
      "business",
      "creator"
    ]);


  return Array.from(
    new Set(
      values.filter(
        (
          value
        ): value is
          DiscoveryProfileType =>
          valid.has(value)
      )
    )
  );
}


/* ============================================================
   ROW MAPPER
   ============================================================ */

function mapDiscoveryRow(
  row:
    DiscoveryRow
): DiscoveryResult {
  return {
    userId:
      row.user_id,

    username:
      row.handle,

    beanId:
      formatBeanId(
        row.handle
      ),

    displayName:
      row.display_name,

    bio:
      row.bio,

    avatarUrl:
      getAvatarUrl(
        row.avatar_path
      ),

    profileType:
      row.profile_type,

    city:
      row.city,

    countryCode:
      row.country_code,

    isAvailableForWork:
      row.is_available_for_work
  };
}


/* ============================================================
   EXACT BEAN ID LOOKUP

   Examples accepted:

   bean@samuel
   samuel
   @samuel
   legacy samuel@bean

   Canonical result:
   bean@samuel
   ============================================================ */

export async function findByBeanId(
  rawBeanId: string
): Promise<DiscoveryResult | null> {
  requireAuthenticatedUser();

  assertDiscoveryEnabled();


  const username =
    normalizeUsername(
      rawBeanId
    );


  if (!username) {
    return null;
  }


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_discovery_profiles"
        )
        .select(
          `
            user_id,
            handle,
            display_name,
            bio,
            avatar_path,
            profile_type,
            city,
            country_code,
            is_available_for_work
          `
        )
        .eq(
          "handle",
          username
        )
        .maybeSingle<
          DiscoveryRow
        >();


    if (error) {
      throw error;
    }


    return data
      ? mapDiscoveryRow(
          data
        )
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "discovery",

        context: {
          operation:
            "findByBeanId",

          username
        }
      }
    );
  }
}


/* ============================================================
   DISCOVERY SEARCH

   Final schema will expose:
   bean_discovery_profiles

   This should be either:
   - security-barrier view
   - RPC-backed projection
   - equivalent RLS-safe discovery table/view

   Browser never searches raw auth/account tables.
   ============================================================ */

export async function searchDiscovery(
  input:
    DiscoverySearchInput = {}
): Promise<DiscoverySearchResult> {
  const account =
    requireAuthenticatedUser();


  assertDiscoveryEnabled();


  const searchQuery =
    normalizeSearchQuery(
      input.query
    );


  const profileTypes =
    normalizeProfileTypes(
      input.profileTypes
    );


  const countryCode =
    normalizeCountryCode(
      input.countryCode
    );


  const city =
    input.city
      ?.trim()
      .slice(
        0,
        100
      ) ||
    null;


  const limit =
    normalizeLimit(
      input.limit
    );


  const offset =
    normalizeOffset(
      input.offset
    );


  try {
    let query =
      supabase
        .from(
          "bean_discovery_profiles"
        )
        .select(
          `
            user_id,
            handle,
            display_name,
            bio,
            avatar_path,
            profile_type,
            city,
            country_code,
            is_available_for_work
          `
        )
        /*
         * Don't return current user in general discovery.
         */
        .neq(
          "user_id",
          account.id
        );


    /* ========================================================
       TEXT SEARCH

       If user enters canonical Bean ID syntax,
       search handle first.

       Otherwise search display name / handle.
       ======================================================== */

    if (searchQuery) {
      const normalizedUsername =
        normalizeUsername(
          searchQuery
        );


      const looksLikeBeanId =
        searchQuery
          .toLowerCase()
          .startsWith(
            "bean@"
          );


      if (
        looksLikeBeanId &&
        normalizedUsername
      ) {
        query =
          query.ilike(
            "handle",
            `${normalizedUsername}%`
          );
      } else {
        /*
         * Escape characters meaningful to PostgREST
         * pattern expressions before constructing filters.
         */
        const safeQuery =
          escapeSearchPattern(
            searchQuery
          );


        query =
          query.or(
            [
              `handle.ilike.%${safeQuery}%`,
              `display_name.ilike.%${safeQuery}%`
            ].join(",")
          );
      }
    }


    /* ========================================================
       PROFILE TYPE FILTER
       ======================================================== */

    if (
      profileTypes.length >
        0
    ) {
      query =
        query.in(
          "profile_type",
          profileTypes
        );
    }


    /* ========================================================
       COUNTRY
       ======================================================== */

    if (
      countryCode
    ) {
      query =
        query.eq(
          "country_code",
          countryCode
        );
    }


    /* ========================================================
       CITY
       ======================================================== */

    if (
      city
    ) {
      query =
        query.ilike(
          "city",
          city
        );
    }


    /* ========================================================
       AVAILABLE FOR WORK
       ======================================================== */

    if (
      input.availableForWork !==
        undefined
    ) {
      query =
        query.eq(
          "is_available_for_work",
          input.availableForWork
        );
    }


    /*
     * Fetch one extra row to calculate hasMore.
     */
    const {
      data,
      error
    } =
      await query
        .order(
          "display_name",
          {
            ascending:
              true
          }
        )
        .order(
          "user_id",
          {
            ascending:
              true
          }
        )
        .range(
          offset,
          offset + limit
        );


    if (error) {
      throw error;
    }


    const rows =
      (
        data as
          DiscoveryRow[] | null
      ) ?? [];


    const hasMore =
      rows.length >
        limit;


    const pageRows =
      hasMore
        ? rows.slice(
            0,
            limit
          )
        : rows;


    return {
      items:
        pageRows.map(
          mapDiscoveryRow
        ),

      offset,

      limit,

      hasMore
    };
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "discovery",

        context: {
          operation:
            "searchDiscovery",

          query:
            searchQuery,

          offset,

          limit
        }
      }
    );
  }
}


/* ============================================================
   PROFESSIONAL DISCOVERY
   ============================================================ */

export async function discoverProfessionals(
  input:
    Omit<
      DiscoverySearchInput,
      "profileTypes"
    > = {}
): Promise<DiscoverySearchResult> {
  return searchDiscovery({
    ...input,

    profileTypes: [
      "professional",
      "business",
      "creator"
    ]
  });
}


/* ============================================================
   AVAILABLE FOR WORK
   ============================================================ */

export async function discoverAvailableForWork(
  input:
    Omit<
      DiscoverySearchInput,
      "availableForWork"
    > = {}
): Promise<DiscoverySearchResult> {
  return searchDiscovery({
    ...input,

    availableForWork:
      true
  });
}


/* ============================================================
   BUSINESS DISCOVERY
   ============================================================ */

export async function discoverBusinesses(
  input:
    Omit<
      DiscoverySearchInput,
      "profileTypes"
    > = {}
): Promise<DiscoverySearchResult> {
  return searchDiscovery({
    ...input,

    profileTypes: [
      "business"
    ]
  });
}


/* ============================================================
   CREATOR DISCOVERY
   ============================================================ */

export async function discoverCreators(
  input:
    Omit<
      DiscoverySearchInput,
      "profileTypes"
    > = {}
): Promise<DiscoverySearchResult> {
  return searchDiscovery({
    ...input,

    profileTypes: [
      "creator"
    ]
  });
}


/* ============================================================
   SAFE SEARCH PATTERN

   Prevent user input from accidentally becoming raw
   PostgREST filter syntax.

   This is NOT the final security boundary.
   Database/RLS remains authoritative.
   ============================================================ */

function escapeSearchPattern(
  value: string
): string {
  return value
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /%/g,
      "\\%"
    )
    .replace(
      /_/g,
      "\\_"
    )
    .replace(
      /,/g,
      "\\,"
    )
    .replace(
      /\(/g,
      "\\("
    )
    .replace(
      /\)/g,
      "\\)"
    );
}


/* ============================================================
   DISPLAY LABEL

   Example:

   Samuel Yousaf
   bean@samuel
   ============================================================ */

export function getDiscoveryDisplayLabel(
  result:
    DiscoveryResult
): string {
  if (
    result.displayName
      .trim()
  ) {
    return result.displayName;
  }


  return result.beanId;
}
