/* ============================================================
   BEAN — SIGNATURESI
   Central Error System

   Responsibilities:
   - Define stable application error codes
   - Normalize unknown/external errors
   - Classify retryable vs non-retryable failures
   - Keep safe user-facing messages separate from raw details
   - Provide one predictable error contract to every module

   Must NOT own:
   - UI rendering
   - Toasts / dialogs
   - Logging transport
   - Supabase queries
   - Authentication logic
   - Retry scheduling
   ============================================================ */


/* ============================================================
   ERROR SOURCES
   ============================================================ */

export type BeanErrorSource =
  | "core"
  | "data"
  | "auth"
  | "identity"
  | "conversations"
  | "messages"
  | "realtime"
  | "presence"
  | "crypto"
  | "media"
  | "notifications"
  | "calls"
  | "profile"
  | "discovery"
  | "work"
  | "beanmoji"
  | "settings"
  | "ui"
  | "unknown";


/* ============================================================
   STABLE ERROR CODES

   These codes are part of Bean's internal contract.
   UI should react to codes, not parse message strings.
   ============================================================ */

export type BeanErrorCode =

  /* Generic */
  | "UNKNOWN"
  | "INVALID_INPUT"
  | "NOT_SUPPORTED"
  | "CONFIGURATION_ERROR"

  /* Network / service */
  | "OFFLINE"
  | "NETWORK_ERROR"
  | "REQUEST_TIMEOUT"
  | "SERVICE_UNAVAILABLE"
  | "RATE_LIMITED"

  /* Authentication */
  | "AUTH_REQUIRED"
  | "AUTH_EXPIRED"
  | "AUTH_INVALID"
  | "AUTH_FORBIDDEN"
  | "AUTH_ACCOUNT_DISABLED"

  /* Identity */
  | "IDENTITY_NOT_FOUND"
  | "HANDLE_INVALID"
  | "HANDLE_TAKEN"
  | "HANDLE_RESERVED"

  /* Conversations / messaging */
  | "CONVERSATION_NOT_FOUND"
  | "CONVERSATION_FORBIDDEN"
  | "MESSAGE_NOT_FOUND"
  | "MESSAGE_SEND_FAILED"
  | "MESSAGE_EDIT_FAILED"
  | "MESSAGE_DELETE_FAILED"

  /* Realtime */
  | "REALTIME_CONNECT_FAILED"
  | "REALTIME_SUBSCRIBE_FAILED"

  /* Crypto */
  | "CRYPTO_NOT_READY"
  | "CRYPTO_KEY_MISSING"
  | "CRYPTO_ENCRYPT_FAILED"
  | "CRYPTO_DECRYPT_FAILED"
  | "CRYPTO_UNSUPPORTED_PROTOCOL"

  /* Media */
  | "MEDIA_INVALID_FILE"
  | "MEDIA_FILE_TOO_LARGE"
  | "MEDIA_UPLOAD_FAILED"
  | "MEDIA_DOWNLOAD_FAILED"

  /* Calls */
  | "CALL_NOT_ALLOWED"
  | "CALL_DEVICE_UNAVAILABLE"
  | "CALL_CONNECTION_FAILED"

  /* Safety */
  | "USER_BLOCKED"
  | "PERMISSION_DENIED";


/* ============================================================
   ERROR CONTEXT
   Safe structured metadata for debugging/telemetry.
   Never put passwords, JWTs or encryption secrets here.
   ============================================================ */

export type BeanErrorContext =
  Readonly<Record<string, unknown>>;


/* ============================================================
   BEAN ERROR
   ============================================================ */

export interface BeanErrorOptions {
  code: BeanErrorCode;

  source?: BeanErrorSource;

  message?: string;

  userMessage?: string;

  retryable?: boolean;

  cause?: unknown;

  context?: BeanErrorContext;
}


export class BeanError extends Error {
  readonly code: BeanErrorCode;

  readonly source: BeanErrorSource;

  readonly userMessage: string;

  readonly retryable: boolean;

  readonly context: BeanErrorContext;

  override readonly cause?: unknown;


  constructor(
    options: BeanErrorOptions
  ) {
    const internalMessage =
      options.message ??
      defaultInternalMessage(
        options.code
      );

    super(internalMessage);

    this.name = "BeanError";

    this.code =
      options.code;

    this.source =
      options.source ??
      "unknown";

    this.userMessage =
      options.userMessage ??
      defaultUserMessage(
        options.code
      );

    this.retryable =
      options.retryable ??
      defaultRetryable(
        options.code
      );

    this.context =
      options.context ??
      Object.freeze({});

    if (
      options.cause !== undefined
    ) {
      this.cause =
        options.cause;
    }
  }
}


/* ============================================================
   DEFAULT INTERNAL MESSAGES
   Intended for logs/development.
   ============================================================ */

function defaultInternalMessage(
  code: BeanErrorCode
): string {
  switch (code) {
    case "INVALID_INPUT":
      return "The supplied input is invalid.";

    case "NOT_SUPPORTED":
      return "The requested operation is not supported.";

    case "CONFIGURATION_ERROR":
      return "Bean configuration is invalid.";

    case "OFFLINE":
      return "The device is currently offline.";

    case "NETWORK_ERROR":
      return "A network request failed.";

    case "REQUEST_TIMEOUT":
      return "The request timed out.";

    case "SERVICE_UNAVAILABLE":
      return "The required service is unavailable.";

    case "RATE_LIMITED":
      return "The request was rate limited.";

    case "AUTH_REQUIRED":
      return "Authentication is required.";

    case "AUTH_EXPIRED":
      return "The authentication session has expired.";

    case "AUTH_INVALID":
      return "The authentication session is invalid.";

    case "AUTH_FORBIDDEN":
      return "The authenticated user is not authorized.";

    case "AUTH_ACCOUNT_DISABLED":
      return "The account is disabled.";

    case "IDENTITY_NOT_FOUND":
      return "The requested identity was not found.";

    case "HANDLE_INVALID":
      return "The Bean handle is invalid.";

    case "HANDLE_TAKEN":
      return "The Bean handle is already taken.";

    case "HANDLE_RESERVED":
      return "The Bean handle is reserved.";

    case "CONVERSATION_NOT_FOUND":
      return "The conversation was not found.";

    case "CONVERSATION_FORBIDDEN":
      return "Access to the conversation is forbidden.";

    case "MESSAGE_NOT_FOUND":
      return "The message was not found.";

    case "MESSAGE_SEND_FAILED":
      return "The message could not be sent.";

    case "MESSAGE_EDIT_FAILED":
      return "The message could not be edited.";

    case "MESSAGE_DELETE_FAILED":
      return "The message could not be deleted.";

    case "REALTIME_CONNECT_FAILED":
      return "Realtime connection failed.";

    case "REALTIME_SUBSCRIBE_FAILED":
      return "Realtime subscription failed.";

    case "CRYPTO_NOT_READY":
      return "The cryptographic runtime is not ready.";

    case "CRYPTO_KEY_MISSING":
      return "A required cryptographic key is missing.";

    case "CRYPTO_ENCRYPT_FAILED":
      return "Encryption failed.";

    case "CRYPTO_DECRYPT_FAILED":
      return "Decryption failed.";

    case "CRYPTO_UNSUPPORTED_PROTOCOL":
      return "The cryptographic protocol is unsupported.";

    case "MEDIA_INVALID_FILE":
      return "The selected media file is invalid.";

    case "MEDIA_FILE_TOO_LARGE":
      return "The selected media file exceeds the size limit.";

    case "MEDIA_UPLOAD_FAILED":
      return "Media upload failed.";

    case "MEDIA_DOWNLOAD_FAILED":
      return "Media download failed.";

    case "CALL_NOT_ALLOWED":
      return "The call is not allowed.";

    case "CALL_DEVICE_UNAVAILABLE":
      return "A required call device is unavailable.";

    case "CALL_CONNECTION_FAILED":
      return "The call connection failed.";

    case "USER_BLOCKED":
      return "The operation is blocked by a user relationship.";

    case "PERMISSION_DENIED":
      return "Permission was denied.";

    case "UNKNOWN":
    default:
      return "An unexpected Bean error occurred.";
  }
}


/* ============================================================
   DEFAULT USER MESSAGES
   Short, safe and non-technical.
   ============================================================ */

function defaultUserMessage(
  code: BeanErrorCode
): string {
  switch (code) {
    case "INVALID_INPUT":
      return "Check the information and try again.";

    case "OFFLINE":
      return "You're offline. Check your connection.";

    case "NETWORK_ERROR":
    case "REQUEST_TIMEOUT":
      return "Connection problem. Try again.";

    case "SERVICE_UNAVAILABLE":
      return "Bean is temporarily unavailable.";

    case "RATE_LIMITED":
      return "Too many attempts. Try again shortly.";

    case "AUTH_REQUIRED":
      return "Sign in to continue.";

    case "AUTH_EXPIRED":
    case "AUTH_INVALID":
      return "Your session ended. Sign in again.";

    case "AUTH_FORBIDDEN":
    case "PERMISSION_DENIED":
      return "You don't have permission to do that.";

    case "AUTH_ACCOUNT_DISABLED":
      return "This account is currently unavailable.";

    case "IDENTITY_NOT_FOUND":
      return "We couldn't find that Bean account.";

    case "HANDLE_INVALID":
      return "Choose a valid Bean ID.";

    case "HANDLE_TAKEN":
      return "That Bean ID is already taken.";

    case "HANDLE_RESERVED":
      return "That Bean ID isn't available.";

    case "CONVERSATION_NOT_FOUND":
      return "This conversation is no longer available.";

    case "CONVERSATION_FORBIDDEN":
    case "USER_BLOCKED":
      return "You can't access this conversation.";

    case "MESSAGE_NOT_FOUND":
      return "This message is no longer available.";

    case "MESSAGE_SEND_FAILED":
      return "Message not sent. Try again.";

    case "MESSAGE_EDIT_FAILED":
      return "Message couldn't be updated.";

    case "MESSAGE_DELETE_FAILED":
      return "Message couldn't be removed.";

    case "REALTIME_CONNECT_FAILED":
    case "REALTIME_SUBSCRIBE_FAILED":
      return "Live connection interrupted.";

    case "CRYPTO_NOT_READY":
    case "CRYPTO_KEY_MISSING":
      return "Secure messaging isn't ready yet.";

    case "CRYPTO_ENCRYPT_FAILED":
      return "Message couldn't be secured.";

    case "CRYPTO_DECRYPT_FAILED":
      return "This message couldn't be decrypted.";

    case "CRYPTO_UNSUPPORTED_PROTOCOL":
      return "Update Bean to open this secure message.";

    case "MEDIA_INVALID_FILE":
      return "This file can't be used.";

    case "MEDIA_FILE_TOO_LARGE":
      return "This file is too large.";

    case "MEDIA_UPLOAD_FAILED":
      return "Upload failed. Try again.";

    case "MEDIA_DOWNLOAD_FAILED":
      return "Download failed. Try again.";

    case "CALL_NOT_ALLOWED":
      return "This call can't be started.";

    case "CALL_DEVICE_UNAVAILABLE":
      return "Check your camera or microphone permissions.";

    case "CALL_CONNECTION_FAILED":
      return "Call connection failed.";

    case "CONFIGURATION_ERROR":
    case "NOT_SUPPORTED":
    case "UNKNOWN":
    default:
      return "Something went wrong. Try again.";
  }
}


/* ============================================================
   DEFAULT RETRY BEHAVIOR
   ============================================================ */

function defaultRetryable(
  code: BeanErrorCode
): boolean {
  switch (code) {
    case "OFFLINE":
    case "NETWORK_ERROR":
    case "REQUEST_TIMEOUT":
    case "SERVICE_UNAVAILABLE":
    case "RATE_LIMITED":
    case "MESSAGE_SEND_FAILED":
    case "REALTIME_CONNECT_FAILED":
    case "REALTIME_SUBSCRIBE_FAILED":
    case "MEDIA_UPLOAD_FAILED":
    case "MEDIA_DOWNLOAD_FAILED":
    case "CALL_CONNECTION_FAILED":
      return true;

    default:
      return false;
  }
}


/* ============================================================
   TYPE GUARD
   ============================================================ */

export function isBeanError(
  error: unknown
): error is BeanError {
  return error instanceof BeanError;
}


/* ============================================================
   NORMALIZATION
   Converts unknown library/runtime errors into BeanError.
   ============================================================ */

export interface NormalizeErrorOptions {
  source?: BeanErrorSource;

  fallbackCode?: BeanErrorCode;

  context?: BeanErrorContext;
}


interface ExternalErrorShape {
  message?: unknown;
  code?: unknown;
  status?: unknown;
}


export function normalizeError(
  error: unknown,
  options: NormalizeErrorOptions = {}
): BeanError {
  if (isBeanError(error)) {
    return error;
  }


  const source =
    options.source ??
    "unknown";

  const context =
    options.context;


  if (
    error instanceof DOMException
  ) {
    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError"
    ) {
      return new BeanError({
        code: "REQUEST_TIMEOUT",
        source,
        cause: error,
        context
      });
    }

    if (
      error.name === "NotAllowedError"
    ) {
      return new BeanError({
        code: "PERMISSION_DENIED",
        source,
        cause: error,
        context
      });
    }
  }


  if (
    typeof error === "object" &&
    error !== null
  ) {
    const candidate =
      error as ExternalErrorShape;

    const status =
      typeof candidate.status === "number"
        ? candidate.status
        : null;

    const externalCode =
      typeof candidate.code === "string"
        ? candidate.code
        : null;

    const message =
      typeof candidate.message === "string"
        ? candidate.message
        : undefined;


    if (status === 401) {
      return new BeanError({
        code: "AUTH_INVALID",
        source,
        message,
        cause: error,
        context
      });
    }


    if (status === 403) {
      return new BeanError({
        code: "AUTH_FORBIDDEN",
        source,
        message,
        cause: error,
        context
      });
    }


    if (status === 404) {
      return new BeanError({
        code:
          options.fallbackCode ??
          "UNKNOWN",

        source,
        message,
        cause: error,

        context: {
          ...context,
          status
        }
      });
    }


    if (status === 408) {
      return new BeanError({
        code: "REQUEST_TIMEOUT",
        source,
        message,
        cause: error,
        context
      });
    }


    if (status === 429) {
      return new BeanError({
        code: "RATE_LIMITED",
        source,
        message,
        cause: error,
        context
      });
    }


    if (
      status !== null &&
      status >= 500
    ) {
      return new BeanError({
        code: "SERVICE_UNAVAILABLE",
        source,
        message,
        cause: error,
        context
      });
    }


    return new BeanError({
      code:
        options.fallbackCode ??
        "UNKNOWN",

      source,

      message,

      cause: error,

      context: {
        ...context,

        externalCode,

        status
      }
    });
  }


  if (
    typeof error === "string"
  ) {
    return new BeanError({
      code:
        options.fallbackCode ??
        "UNKNOWN",

      source,

      message: error,

      cause: error,

      context
    });
  }


  return new BeanError({
    code:
      options.fallbackCode ??
      "UNKNOWN",

    source,

    cause: error,

    context
  });
}


/* ============================================================
   ERROR FACTORY
   Convenience helper for modules.
   ============================================================ */

export function createError(
  code: BeanErrorCode,
  source: BeanErrorSource,
  options: Omit<
    BeanErrorOptions,
    "code" | "source"
  > = {}
): BeanError {
  return new BeanError({
    ...options,
    code,
    source
  });
}


/* ============================================================
   SAFE SERIALIZATION
   For future telemetry.ts.

   Never serialize arbitrary causes because they may contain
   headers, tokens or other sensitive runtime information.
   ============================================================ */

export interface SerializedBeanError {
  name: "BeanError";

  code: BeanErrorCode;

  source: BeanErrorSource;

  message: string;

  retryable: boolean;

  context: BeanErrorContext;
}


export function serializeError(
  error: BeanError
): SerializedBeanError {
  return {
    name: "BeanError",

    code:
      error.code,

    source:
      error.source,

    message:
      error.message,

    retryable:
      error.retryable,

    context:
      error.context
  };
}
