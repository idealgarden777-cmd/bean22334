import {
  createClient,
  type SupabaseClient
} from "@supabase/supabase-js";

import { config } from "./core";


/* ============================================================
   BEAN — SIGNATURESI
   Supabase Data Boundary

   Responsibilities:
   - Own the single browser Supabase client
   - Provide authenticated JWT access to Supabase
   - Expose safe database/realtime/storage entry points
   - Keep Supabase configuration out of feature modules

   Must NOT own:
   - Login / logout UX
   - Signaturesi account session logic
   - Bean identity rules
   - Messaging business logic
   - Realtime channel lifecycle
   - Encryption
   ============================================================ */


/* ============================================================
   ACCESS TOKEN PROVIDER

   auth.ts will register the active Signaturesi/Supabase JWT
   provider here after identity/session initialization.

   data.ts does not know where the token comes from.
   ============================================================ */

export type AccessTokenProvider =
  () => Promise<string | null>;


let accessTokenProvider:
  AccessTokenProvider | null = null;


/**
 * Registers the current authentication token provider.
 *
 * auth.ts owns the real session implementation.
 */
export function setAccessTokenProvider(
  provider: AccessTokenProvider | null
): void {
  accessTokenProvider = provider;
}


/**
 * Called internally by Supabase whenever it needs
 * the current authenticated access token.
 */
async function getAccessToken():
  Promise<string | null> {
  if (!accessTokenProvider) {
    return null;
  }

  try {
    const token =
      await accessTokenProvider();

    if (
      typeof token !== "string" ||
      token.trim().length === 0
    ) {
      return null;
    }

    return token;
  } catch (error) {
    console.error(
      "[Bean:data] Access token provider failed.",
      error
    );

    return null;
  }
}


/* ============================================================
   CLIENT
   ============================================================ */

export const supabase: SupabaseClient =
  createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      /*
       * Bean's authentication lifecycle is owned externally
       * by auth.ts / Signaturesi Identity.
       *
       * We therefore do not allow supabase-js to create a
       * second competing browser session system here.
       */
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },

      /*
       * Current Supabase-supported mechanism for supplying
       * a custom / third-party JWT.
       */
      accessToken: getAccessToken,

      db: {
        schema: "public"
      },

      global: {
        headers: {
          "X-Client-Info":
            "signaturesi-bean-web"
        }
      },

      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    }
  );


/* ============================================================
   DATA ERROR
   Normalizes external errors before feature modules see them.
   Full user-facing error handling will live in errors.ts.
   ============================================================ */

export interface DataError {
  source: "supabase";
  message: string;
  code: string | null;
  details: string | null;
}


interface SupabaseLikeError {
  message?: unknown;
  code?: unknown;
  details?: unknown;
}


export function normalizeDataError(
  error: unknown
): DataError {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const candidate =
      error as SupabaseLikeError;

    return {
      source: "supabase",

      message:
        typeof candidate.message === "string"
          ? candidate.message
          : "Unexpected data error.",

      code:
        typeof candidate.code === "string"
          ? candidate.code
          : null,

      details:
        typeof candidate.details === "string"
          ? candidate.details
          : null
    };
  }

  return {
    source: "supabase",

    message:
      error instanceof Error
        ? error.message
        : "Unexpected data error.",

    code: null,
    details: null
  };
}


/* ============================================================
   CONNECTION HELPERS
   ============================================================ */

export function isDataServiceConfigured():
  boolean {
  try {
    const url =
      new URL(config.supabaseUrl);

    return (
      url.protocol === "https:" &&
      config.supabasePublishableKey.startsWith(
        "sb_publishable_"
      )
    );
  } catch {
    return false;
  }
}


/**
 * Lightweight connection test.
 *
 * No private user data is requested.
 * This will later query a public/read-safe feature flag table.
 */
export async function testDataConnection():
  Promise<boolean> {
  try {
    const { error } =
      await supabase
        .from("bean_feature_flags")
        .select("key")
        .limit(1);

    if (error) {
      console.warn(
        "[Bean:data] Supabase connection test failed.",
        normalizeDataError(error)
      );

      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      "[Bean:data] Supabase connection test failed.",
      normalizeDataError(error)
    );

    return false;
  }
}


/* ============================================================
   AUTH TOKEN CHANGE

   After auth.ts changes/refreshes the active JWT,
   Realtime also needs the latest token.
   ============================================================ */

export async function refreshRealtimeAuth():
  Promise<void> {
  const token =
    await getAccessToken();

  if (token) {
    await supabase.realtime.setAuth(token);
    return;
  }

  /*
   * Calling without a token returns Realtime to the
   * configured accessToken callback as its source.
   */
  await supabase.realtime.setAuth();
}


/* ============================================================
   CLEANUP
   Used when the app signs out or resets its runtime.
   ============================================================ */

export async function resetDataRuntime():
  Promise<void> {
  await supabase.removeAllChannels();

  accessTokenProvider = null;

  await supabase.realtime.setAuth();
}
