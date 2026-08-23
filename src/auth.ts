import { config } from "./core";

import {
  refreshRealtimeAuth,
  resetDataRuntime,
  setAccessTokenProvider
} from "./data";

import {
  BeanError,
  createError,
  normalizeError
} from "./errors";


/* ============================================================
   BEAN — SIGNATURESI
   Authentication Module

   Responsibilities:
   - Restore the central Signaturesi session
   - Hold current authenticated account state
   - Redirect users to Signaturesi Accounts
   - Perform central logout
   - Supply an optional Supabase-compatible access token
   - Emit predictable authentication lifecycle events

   Must NOT own:
   - Password handling
   - Bean ID rules
   - Profile rendering
   - Database queries
   - Messaging
   - Supabase client creation
   - Local password/session storage
   ============================================================ */


/* ============================================================
   TYPES
   ============================================================ */

export type BeanPlan =
  | "free"
  | "pro";


export interface AuthenticatedUser {
  id: string;

  username: string;

  displayName: string;

  beanId: string | null;

  email: string | null;

  planType: string;

  plan: BeanPlan;
}


export type AuthStatus =
  | "idle"
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "error";


export interface AuthState {
  status: AuthStatus;

  user: AuthenticatedUser | null;

  plan: BeanPlan;

  checkedAt: number | null;

  error: BeanError | null;
}


interface SessionUserPayload {
  id?: unknown;

  username?: unknown;

  displayName?: unknown;

  beanId?: unknown;

  email?: unknown;

  planType?: unknown;
}


interface SessionResponse {
  authenticated?: unknown;

  user?: SessionUserPayload;

  /*
   * Current Signaturesi session may not expose this yet.
   *
   * When the Accounts service starts issuing a
   * Supabase-compatible short-lived JWT, Bean can consume it
   * without changing the public auth API.
   */
  accessToken?: unknown;
}


/* ============================================================
   ENDPOINTS
   ============================================================ */

const ACCOUNTS_ORIGIN =
  config.accountsUrl.replace(
    /\/+$/,
    ""
  );


const LOGIN_URL =
  `${ACCOUNTS_ORIGIN}/?mode=login`;


const SESSION_ENDPOINT =
  `${ACCOUNTS_ORIGIN}/api/auth/session`;


const LOGOUT_ENDPOINT =
  `${ACCOUNTS_ORIGIN}/api/auth/logout`;


/* ============================================================
   STATE
   ============================================================ */

const state: AuthState = {
  status: "idle",

  user: null,

  plan: "free",

  checkedAt: null,

  error: null
};


let restorePromise:
  Promise<boolean> | null = null;


let logoutPromise:
  Promise<void> | null = null;


/*
 * Access token is memory-only.
 *
 * Never persist this in localStorage/sessionStorage.
 */
let supabaseAccessToken:
  string | null = null;


/* ============================================================
   STATE ACCESS
   ============================================================ */

export function getAuthState():
  Readonly<AuthState> {
  return state;
}


export function getCurrentUser():
  AuthenticatedUser | null {
  return state.user;
}


export function isAuthenticated():
  boolean {
  return (
    state.status ===
      "authenticated" &&
    state.user !== null
  );
}


/* ============================================================
   EVENTS
   ============================================================ */

export type AuthEventName =
  | "bean:auth-check-start"
  | "bean:auth-restored"
  | "bean:auth-required"
  | "bean:auth-error"
  | "bean:auth-check-end"
  | "bean:logout-start"
  | "bean:logout-success"
  | "bean:logout-error";


function emitAuthEvent(
  name: AuthEventName,
  detail?: unknown
): void {
  window.dispatchEvent(
    new CustomEvent(
      name,
      {
        detail
      }
    )
  );
}


/* ============================================================
   VALUE HELPERS
   ============================================================ */

function asNonEmptyString(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }


  const result =
    value.trim();


  return result.length > 0
    ? result
    : null;
}


/* ============================================================
   PLAN NORMALIZATION

   Signaturesi may have multiple commercial plan names.
   Bean currently only needs the entitlement level:
   free / pro.
   ============================================================ */

function normalizePlan(
  value: unknown
): BeanPlan {
  const plan =
    asNonEmptyString(value)
      ?.toLowerCase() ??
    "free";


  const proPlans =
    new Set<string>([
      "pro",

      "bean_pro",
      "bean-pro",

      "neo_pro",
      "neo-pro",

      "neyo_pro",
      "neyo-pro",

      "premium",
      "business",
      "suite"
    ]);


  return proPlans.has(plan)
    ? "pro"
    : "free";
}


/* ============================================================
   USER NORMALIZATION
   ============================================================ */

function normalizeUser(
  payload: SessionUserPayload | undefined
): AuthenticatedUser | null {
  if (!payload) {
    return null;
  }


  const id =
    asNonEmptyString(
      payload.id
    );


  if (!id) {
    return null;
  }


  const username =
    asNonEmptyString(
      payload.username
    ) ??
    "user";


  const displayName =
    asNonEmptyString(
      payload.displayName
    ) ??
    username;


  const beanId =
    asNonEmptyString(
      payload.beanId
    );


  const email =
    asNonEmptyString(
      payload.email
    );


  const planType =
    asNonEmptyString(
      payload.planType
    ) ??
    "free";


  return {
    id,

    username,

    displayName,

    beanId,

    email,

    planType,

    plan:
      normalizePlan(
        planType
      )
  };
}


/* ============================================================
   TOKEN MANAGEMENT
   ============================================================ */

function setSupabaseAccessToken(
  token: string | null
): void {
  supabaseAccessToken =
    token;


  if (!token) {
    setAccessTokenProvider(
      null
    );

    return;
  }


  setAccessTokenProvider(
    async () =>
      supabaseAccessToken
  );
}


/* ============================================================
   LOCAL LEGACY AUTH CLEANUP

   Only remove old authentication leftovers.
   Never clear all localStorage because UI preferences,
   drafts or other non-auth settings may live there.
   ============================================================ */

function clearLegacyAuthStorage():
  void {
  const localKeys = [
    "bean_user",
    "bean_session",
    "bean_auth",

    "neo_user",
    "neo_session",
    "neo_auth",

    "neyo_user",
    "neyo_session",
    "neyo_auth"
  ];


  for (
    const key of localKeys
  ) {
    try {
      localStorage.removeItem(
        key
      );
    } catch {
      /*
       * Storage may be unavailable in restricted
       * browser contexts.
       */
    }
  }


  const sessionKeys = [
    "bean_user",
    "bean_session",
    "bean_auth",

    "neo_user",
    "neyo_user"
  ];


  for (
    const key of sessionKeys
  ) {
    try {
      sessionStorage.removeItem(
        key
      );
    } catch {
      // Storage unavailable.
    }
  }
}


/* ============================================================
   CLEAR AUTH STATE
   ============================================================ */

async function clearAuthState():
  Promise<void> {
  state.status =
    "unauthenticated";

  state.user =
    null;

  state.plan =
    "free";

  state.error =
    null;


  setSupabaseAccessToken(
    null
  );


  clearLegacyAuthStorage();


  await resetDataRuntime();
}


/* ============================================================
   LOGIN REDIRECT
   ============================================================ */

export function redirectToLogin():
  void {
  window.location.replace(
    LOGIN_URL
  );
}


/* ============================================================
   SESSION REQUEST
   ============================================================ */

async function fetchSession():
  Promise<SessionResponse> {
  let response: Response;


  try {
    response =
      await fetch(
        SESSION_ENDPOINT,
        {
          method: "GET",

          credentials:
            "include",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }
      );
  } catch (error) {
    throw createError(
      navigator.onLine
        ? "NETWORK_ERROR"
        : "OFFLINE",

      "auth",

      {
        cause: error
      }
    );
  }


  let payload:
    SessionResponse = {};


  try {
    payload =
      await response.json() as
        SessionResponse;
  } catch {
    /*
     * Invalid JSON will be handled below
     * according to HTTP status.
     */
  }


  if (
    response.status === 401
  ) {
    return {
      authenticated:
        false
    };
  }


  if (
    response.status === 403
  ) {
    throw createError(
      "AUTH_FORBIDDEN",
      "auth"
    );
  }


  if (
    response.status === 429
  ) {
    throw createError(
      "RATE_LIMITED",
      "auth"
    );
  }


  if (!response.ok) {
    throw createError(
      response.status >= 500
        ? "SERVICE_UNAVAILABLE"
        : "AUTH_INVALID",

      "auth",

      {
        context: {
          status:
            response.status
        }
      }
    );
  }


  return payload;
}


/* ============================================================
   APPLY AUTHENTICATED SESSION
   ============================================================ */

async function applySession(
  payload: SessionResponse
): Promise<boolean> {
  if (
    payload.authenticated !==
      true
  ) {
    await clearAuthState();

    return false;
  }


  const user =
    normalizeUser(
      payload.user
    );


  if (!user) {
    await clearAuthState();

    return false;
  }


  const token =
    asNonEmptyString(
      payload.accessToken
    );


  setSupabaseAccessToken(
    token
  );


  state.status =
    "authenticated";

  state.user =
    user;

  state.plan =
    user.plan;

  state.error =
    null;

  state.checkedAt =
    Date.now();


  /*
   * If Accounts supplied a Supabase-compatible JWT,
   * Realtime receives it immediately.
   *
   * If no token exists yet, identity restoration still
   * succeeds; authenticated Supabase data access will be
   * enabled when the central identity service issues one.
   */
  if (token) {
    await refreshRealtimeAuth();
  }


  emitAuthEvent(
    "bean:auth-restored",
    {
      user: {
        ...user
      },

      plan:
        user.plan
    }
  );


  return true;
}


/* ============================================================
   RESTORE SESSION
   ============================================================ */

export interface RestoreSessionOptions {
  redirect?: boolean;
}


async function performSessionRestore(
  options: RestoreSessionOptions
): Promise<boolean> {
  state.status =
    "checking";

  state.error =
    null;


  emitAuthEvent(
    "bean:auth-check-start"
  );


  try {
    const payload =
      await fetchSession();


    const restored =
      await applySession(
        payload
      );


    if (!restored) {
      emitAuthEvent(
        "bean:auth-required"
      );


      if (
        options.redirect !==
          false
      ) {
        redirectToLogin();
      }


      return false;
    }


    return true;
  } catch (error) {
    const normalized =
      normalizeError(
        error,
        {
          source:
            "auth",

          fallbackCode:
            "AUTH_INVALID"
        }
      );


    state.status =
      "error";

    state.user =
      null;

    state.plan =
      "free";

    state.error =
      normalized;

    state.checkedAt =
      Date.now();


    setSupabaseAccessToken(
      null
    );


    emitAuthEvent(
      "bean:auth-error",
      {
        error:
          normalized
      }
    );


    /*
     * Authentication/network failures should not leave
     * stale user identity in the browser.
     */
    clearLegacyAuthStorage();


    if (
      options.redirect !== false
    ) {
      redirectToLogin();
    }


    return false;
  } finally {
    emitAuthEvent(
      "bean:auth-check-end",
      {
        authenticated:
          isAuthenticated()
      }
    );
  }
}


/**
 * Restores the central Signaturesi session.
 *
 * Duplicate callers share the same in-flight request.
 */
export async function restoreSession(
  options:
    RestoreSessionOptions = {}
): Promise<boolean> {
  if (restorePromise) {
    return restorePromise;
  }


  restorePromise =
    performSessionRestore(
      options
    );


  try {
    return await restorePromise;
  } finally {
    restorePromise =
      null;
  }
}


/* ============================================================
   REQUIRE AUTH
   Useful for feature modules.
   ============================================================ */

export function requireAuthenticatedUser():
  AuthenticatedUser {
  const user =
    getCurrentUser();


  if (!user) {
    throw createError(
      "AUTH_REQUIRED",
      "auth"
    );
  }


  return user;
}


/* ============================================================
   LOGOUT
   ============================================================ */

async function performLogout():
  Promise<void> {
  emitAuthEvent(
    "bean:logout-start"
  );


  try {
    const response =
      await fetch(
        LOGOUT_ENDPOINT,
        {
          method:
            "POST",

          credentials:
            "include",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }
      );


    /*
     * Logout remains local-first.
     *
     * Even if the central server is temporarily unavailable,
     * Bean must clear its local authenticated state.
     */
    if (
      !response.ok &&
      response.status !== 401
    ) {
      emitAuthEvent(
        "bean:logout-error",
        {
          status:
            response.status
        }
      );
    }
  } catch (error) {
    emitAuthEvent(
      "bean:logout-error",
      {
        error:
          normalizeError(
            error,
            {
              source:
                "auth",

              fallbackCode:
                "NETWORK_ERROR"
            }
          )
      }
    );
  } finally {
    await clearAuthState();


    emitAuthEvent(
      "bean:logout-success"
    );


    redirectToLogin();
  }
}


/**
 * Logs the user out from Signaturesi Accounts and Bean.
 *
 * Duplicate logout calls share one operation.
 */
export async function logout():
  Promise<void> {
  if (logoutPromise) {
    return logoutPromise;
  }


  logoutPromise =
    performLogout();


  try {
    await logoutPromise;
  } finally {
    logoutPromise =
      null;
  }
}
