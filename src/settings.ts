import {
  requireAuthenticatedUser
} from "./auth";

import {
  createError,
  normalizeError
} from "./errors";

import {
  getNotificationPreferences,
  updateNotificationPreferences
} from "./notifications";


/* ============================================================
   BEAN — SIGNATURESI
   Settings Module

   Responsibilities:
   - Hold Bean application preferences
   - Persist safe local preferences
   - Validate preference updates
   - Synchronize notification preferences
   - Expose stable settings events
   - Support future server preference synchronization

   Must NOT own:
   - Authentication
   - Account security
   - Bean ID
   - Profile data
   - Theme rendering
   - Notification delivery
   - Messaging
   - Calls
   - UI rendering

   IMPORTANT:
   Local settings must never contain:
   - passwords
   - JWTs
   - private keys
   - crypto secrets
   - Supabase service credentials
   ============================================================ */


/* ============================================================
   STORAGE
   ============================================================ */

const SETTINGS_STORAGE_KEY =
  "bean:settings:v1";


/* ============================================================
   TYPES
   ============================================================ */

export type BeanThemePreference =
  | "system"
  | "light"
  | "dark";


export type BeanDensityPreference =
  | "comfortable"
  | "compact";


export type BeanLanguage =
  | "en"
  | "ur";


export type BeanMessageEnterBehavior =
  | "send"
  | "newline";


export interface BeanSettings {
  theme:
    BeanThemePreference;

  language:
    BeanLanguage;

  density:
    BeanDensityPreference;

  reduceMotion:
    boolean;

  messageEnterBehavior:
    BeanMessageEnterBehavior;

  readReceipts:
    boolean;

  typingIndicators:
    boolean;

  onlineStatus:
    boolean;

  messagePreviews:
    boolean;

  notificationSounds:
    boolean;

  browserNotifications:
    boolean;
}


export interface UpdateBeanSettingsInput {
  theme?:
    BeanThemePreference;

  language?:
    BeanLanguage;

  density?:
    BeanDensityPreference;

  reduceMotion?:
    boolean;

  messageEnterBehavior?:
    BeanMessageEnterBehavior;

  readReceipts?:
    boolean;

  typingIndicators?:
    boolean;

  onlineStatus?:
    boolean;

  messagePreviews?:
    boolean;

  notificationSounds?:
    boolean;

  browserNotifications?:
    boolean;
}


/* ============================================================
   DEFAULTS
   ============================================================ */

const DEFAULT_SETTINGS:
  Readonly<BeanSettings> =
    Object.freeze({
      theme:
        "system",

      language:
        "en",

      density:
        "comfortable",

      reduceMotion:
        false,

      messageEnterBehavior:
        "send",

      readReceipts:
        true,

      typingIndicators:
        true,

      onlineStatus:
        true,

      messagePreviews:
        false,

      notificationSounds:
        true,

      browserNotifications:
        true
    });


/* ============================================================
   STATE
   ============================================================ */

const state:
  BeanSettings = {
    ...DEFAULT_SETTINGS
  };


let initialized =
  false;


/* ============================================================
   EVENTS
   ============================================================ */

export type SettingsEventName =
  | "bean:settings-ready"
  | "bean:settings-change"
  | "bean:settings-reset";


function emitSettingsEvent(
  name: SettingsEventName
): void {
  window.dispatchEvent(
    new CustomEvent(
      name,
      {
        detail: {
          ...state
        }
      }
    )
  );
}


/* ============================================================
   TYPE HELPERS
   ============================================================ */

function isThemePreference(
  value: unknown
): value is BeanThemePreference {
  return (
    value === "system" ||
    value === "light" ||
    value === "dark"
  );
}


function isDensityPreference(
  value: unknown
): value is BeanDensityPreference {
  return (
    value === "comfortable" ||
    value === "compact"
  );
}


function isLanguage(
  value: unknown
): value is BeanLanguage {
  return (
    value === "en" ||
    value === "ur"
  );
}


function isEnterBehavior(
  value: unknown
): value is BeanMessageEnterBehavior {
  return (
    value === "send" ||
    value === "newline"
  );
}


function isBoolean(
  value: unknown
): value is boolean {
  return (
    typeof value ===
      "boolean"
  );
}


/* ============================================================
   SAFE PARSER

   Unknown properties from older/newer versions are ignored.
   ============================================================ */

function parseStoredSettings(
  value: unknown
): Partial<BeanSettings> {
  if (
    typeof value !==
      "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }


  const candidate =
    value as Record<
      string,
      unknown
    >;


  const parsed:
    Partial<BeanSettings> = {};


  if (
    isThemePreference(
      candidate.theme
    )
  ) {
    parsed.theme =
      candidate.theme;
  }


  if (
    isLanguage(
      candidate.language
    )
  ) {
    parsed.language =
      candidate.language;
  }


  if (
    isDensityPreference(
      candidate.density
    )
  ) {
    parsed.density =
      candidate.density;
  }


  if (
    isBoolean(
      candidate.reduceMotion
    )
  ) {
    parsed.reduceMotion =
      candidate.reduceMotion;
  }


  if (
    isEnterBehavior(
      candidate.messageEnterBehavior
    )
  ) {
    parsed.messageEnterBehavior =
      candidate.messageEnterBehavior;
  }


  if (
    isBoolean(
      candidate.readReceipts
    )
  ) {
    parsed.readReceipts =
      candidate.readReceipts;
  }


  if (
    isBoolean(
      candidate.typingIndicators
    )
  ) {
    parsed.typingIndicators =
      candidate.typingIndicators;
  }


  if (
    isBoolean(
      candidate.onlineStatus
    )
  ) {
    parsed.onlineStatus =
      candidate.onlineStatus;
  }


  if (
    isBoolean(
      candidate.messagePreviews
    )
  ) {
    parsed.messagePreviews =
      candidate.messagePreviews;
  }


  if (
    isBoolean(
      candidate.notificationSounds
    )
  ) {
    parsed.notificationSounds =
      candidate.notificationSounds;
  }


  if (
    isBoolean(
      candidate.browserNotifications
    )
  ) {
    parsed.browserNotifications =
      candidate.browserNotifications;
  }


  return parsed;
}


/* ============================================================
   LOCAL STORAGE
   ============================================================ */

function readStoredSettings():
  Partial<BeanSettings> {
  try {
    const raw =
      localStorage.getItem(
        SETTINGS_STORAGE_KEY
      );


    if (!raw) {
      return {};
    }


    const parsed:
      unknown =
        JSON.parse(raw);


    return parseStoredSettings(
      parsed
    );
  } catch (error) {
    console.warn(
      "[Bean:settings] Stored settings could not be read.",
      error
    );


    return {};
  }
}


function persistSettings():
  void {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(
        state
      )
    );
  } catch (error) {
    console.warn(
      "[Bean:settings] Settings could not be persisted.",
      error
    );
  }
}


/* ============================================================
   STATE ACCESS
   ============================================================ */

export function getSettings():
  Readonly<BeanSettings> {
  return state;
}


/* ============================================================
   SYSTEM MOTION PREFERENCE
   ============================================================ */

function prefersReducedMotion():
  boolean {
  return (
    window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches ??
    false
  );
}


/* ============================================================
   INITIALIZE
   ============================================================ */

export function initializeSettings():
  Readonly<BeanSettings> {
  requireAuthenticatedUser();


  if (initialized) {
    return state;
  }


  const stored =
    readStoredSettings();


  Object.assign(
    state,
    DEFAULT_SETTINGS,
    stored
  );


  /*
   * Respect OS accessibility preference unless the user
   * has explicitly stored a preference.
   */
  if (
    stored.reduceMotion ===
      undefined &&
    prefersReducedMotion()
  ) {
    state.reduceMotion =
      true;
  }


  syncNotificationSettings();


  initialized =
    true;


  emitSettingsEvent(
    "bean:settings-ready"
  );


  return state;
}


/* ============================================================
   VALIDATE UPDATE
   ============================================================ */

function validateUpdate(
  input:
    UpdateBeanSettingsInput
): void {
  if (
    input.theme !==
      undefined &&
    !isThemePreference(
      input.theme
    )
  ) {
    throw createError(
      "INVALID_INPUT",
      "settings",
      {
        message:
          "Invalid theme preference."
      }
    );
  }


  if (
    input.language !==
      undefined &&
    !isLanguage(
      input.language
    )
  ) {
    throw createError(
      "INVALID_INPUT",
      "settings",
      {
        message:
          "Invalid language preference."
      }
    );
  }


  if (
    input.density !==
      undefined &&
    !isDensityPreference(
      input.density
    )
  ) {
    throw createError(
      "INVALID_INPUT",
      "settings",
      {
        message:
          "Invalid density preference."
      }
    );
  }


  if (
    input.messageEnterBehavior !==
      undefined &&
    !isEnterBehavior(
      input.messageEnterBehavior
    )
  ) {
    throw createError(
      "INVALID_INPUT",
      "settings",
      {
        message:
          "Invalid message enter behavior."
      }
    );
  }


  const booleanValues:
    unknown[] = [
      input.reduceMotion,
      input.readReceipts,
      input.typingIndicators,
      input.onlineStatus,
      input.messagePreviews,
      input.notificationSounds,
      input.browserNotifications
    ];


  for (
    const value of
    booleanValues
  ) {
    if (
      value !== undefined &&
      !isBoolean(value)
    ) {
      throw createError(
        "INVALID_INPUT",
        "settings"
      );
    }
  }
}


/* ============================================================
   UPDATE
   ============================================================ */

export function updateSettings(
  input:
    UpdateBeanSettingsInput
): Readonly<BeanSettings> {
  requireAuthenticatedUser();


  validateUpdate(
    input
  );


  Object.assign(
    state,
    input
  );


  persistSettings();


  syncNotificationSettings();


  emitSettingsEvent(
    "bean:settings-change"
  );


  return state;
}


/* ============================================================
   NOTIFICATION SYNC

   notifications.ts owns actual delivery.

   settings.ts only tells it the user's preference.
   ============================================================ */

function syncNotificationSettings():
  void {
  const currentNotifications =
    getNotificationPreferences();


  updateNotificationPreferences({
    enabled:
      state.browserNotifications,

    showMessagePreview:
      state.messagePreviews,

    playSound:
      state.notificationSounds
  });


  /*
   * Defensive sanity check.

   * This does not affect execution but helps catch a future
   * notification contract mismatch during development.
   */
  if (
    currentNotifications ===
      undefined
  ) {
    console.warn(
      "[Bean:settings] Notification preferences unavailable."
    );
  }
}


/* ============================================================
   RESET
   ============================================================ */

export function resetSettings():
  Readonly<BeanSettings> {
  requireAuthenticatedUser();


  Object.assign(
    state,
    DEFAULT_SETTINGS
  );


  /*
   * Respect current OS accessibility setting on reset.
   */
  state.reduceMotion =
    prefersReducedMotion();


  try {
    localStorage.removeItem(
      SETTINGS_STORAGE_KEY
    );
  } catch {
    // Continue reset.
  }


  syncNotificationSettings();


  emitSettingsEvent(
    "bean:settings-reset"
  );


  return state;
}


/* ============================================================
   ACCOUNT SESSION RESET

   Called during logout/account replacement.

   Does NOT delete stored preferences automatically because
   device-level preferences may intentionally survive login.

   A user-facing "Reset settings" action calls resetSettings().
   ============================================================ */

export function clearSettingsRuntime():
  void {
  initialized =
    false;


  Object.assign(
    state,
    DEFAULT_SETTINGS
  );
}


/* ============================================================
   THEME RESOLUTION

   Actual DOM/theme styling belongs to ui.ts/styles.

   This function only resolves preference -> effective theme.
   ============================================================ */

export type ResolvedBeanTheme =
  | "light"
  | "dark";


export function resolveTheme():
  ResolvedBeanTheme {
  if (
    state.theme ===
      "light"
  ) {
    return "light";
  }


  if (
    state.theme ===
      "dark"
  ) {
    return "dark";
  }


  const prefersDark =
    window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).matches ??
    false;


  return prefersDark
    ? "dark"
    : "light";
}


/* ============================================================
   IMPORT SETTINGS

   Future:
   server-synchronized preferences may pass through here.

   Unknown keys are ignored.
   ============================================================ */

export function importSettings(
  value: unknown
): Readonly<BeanSettings> {
  requireAuthenticatedUser();


  try {
    const parsed =
      parseStoredSettings(
        value
      );


    Object.assign(
      state,
      parsed
    );


    persistSettings();

    syncNotificationSettings();


    emitSettingsEvent(
      "bean:settings-change"
    );


    return state;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "settings",

        fallbackCode:
          "INVALID_INPUT",

        context: {
          operation:
            "importSettings"
        }
      }
    );
  }
}
