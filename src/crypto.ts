import {
  createError,
  normalizeError
} from "./errors";

import {
  setMessageCryptoProvider,
  type MessageCryptoProvider,
  type SecureMessageEnvelope
} from "./messages";


/* ============================================================
   BEAN — SIGNATURESI
   Cryptography Runtime

   Responsibilities:
   - Own secure messaging crypto lifecycle
   - Verify browser cryptographic capabilities
   - Register an audited E2EE implementation
   - Bridge crypto implementation to messages.ts
   - Validate encrypted message envelopes
   - Manage crypto readiness state
   - Fail closed when secure crypto is unavailable

   Must NOT:
   - Invent a custom encryption protocol
   - Store plaintext messages
   - Store raw private keys in localStorage
   - Fall back to plaintext messaging
   - Derive identity from bean@username
   - Trust user-editable profile metadata as key identity

   IMPORTANT:

   Bean's cryptographic identity must bind to the permanent
   Signaturesi user UUID, not the public Bean ID.

   Internal:
     UUID

   Public:
     bean@username
   ============================================================ */


/* ============================================================
   RUNTIME STATE
   ============================================================ */

export type CryptoRuntimeStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "locked"
  | "failed";


export interface CryptoRuntimeState {
  status: CryptoRuntimeStatus;

  initializedAt: number | null;

  providerName: string | null;

  providerVersion: string | null;

  lastError: unknown | null;
}


const runtimeState:
  CryptoRuntimeState = {
    status:
      "idle",

    initializedAt:
      null,

    providerName:
      null,

    providerVersion:
      null,

    lastError:
      null
  };


export function getCryptoRuntimeState():
  Readonly<CryptoRuntimeState> {
  return runtimeState;
}


/* ============================================================
   CRYPTO EVENTS
   ============================================================ */

export type CryptoEventName =
  | "bean:crypto-initializing"
  | "bean:crypto-ready"
  | "bean:crypto-locked"
  | "bean:crypto-failed"
  | "bean:crypto-reset";


function emitCryptoEvent(
  name: CryptoEventName,
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
   ADAPTER CONTRACT

   A future audited implementation plugs into this contract.

   Possible implementations may use:
   - Signal protocol implementation
   - MLS implementation
   - another formally reviewed protocol/library

   crypto.ts deliberately does NOT implement its own
   messaging protocol.
   ============================================================ */

export interface CryptoProviderInfo {
  name: string;

  version: string;
}


export interface EncryptTextInput {
  conversationId: string;

  clientMessageId: string;

  plaintext: string;
}


export interface DecryptTextInput {
  conversationId: string;

  messageId: string;

  senderId: string;

  envelope: SecureMessageEnvelope;
}


export interface BeanCryptoAdapter {
  readonly info:
    CryptoProviderInfo;


  initialize():
    Promise<void>;


  isReady():
    boolean;


  encryptText(
    input: EncryptTextInput
  ): Promise<SecureMessageEnvelope>;


  decryptText(
    input: DecryptTextInput
  ): Promise<string>;


  lock?():
    Promise<void>;


  reset?():
    Promise<void>;
}


/* ============================================================
   CURRENT ADAPTER
   ============================================================ */

let activeAdapter:
  BeanCryptoAdapter | null = null;


/**
 * Registers the audited cryptographic provider.
 *
 * Registration alone does not make crypto ready.
 * initializeCrypto() must succeed first.
 */
export function registerCryptoAdapter(
  adapter: BeanCryptoAdapter
): void {
  if (
    runtimeState.status ===
      "initializing"
  ) {
    throw createError(
      "CRYPTO_NOT_READY",
      "crypto",
      {
        message:
          "Cannot replace the crypto provider while it is initializing."
      }
    );
  }


  if (
    runtimeState.status ===
      "ready"
  ) {
    throw createError(
      "CRYPTO_NOT_READY",
      "crypto",
      {
        message:
          "Crypto provider cannot be replaced while secure messaging is active."
      }
    );
  }


  activeAdapter =
    adapter;


  runtimeState.providerName =
    adapter.info.name;

  runtimeState.providerVersion =
    adapter.info.version;
}


/* ============================================================
   WEB CRYPTO CAPABILITY

   Web Crypto is required even when the final E2EE protocol
   comes from an audited library because secure randomness
   and browser cryptographic primitives are foundational.
   ============================================================ */

function assertSecureBrowserRuntime():
  void {
  if (
    !window.isSecureContext
  ) {
    throw createError(
      "CRYPTO_NOT_READY",
      "crypto",
      {
        message:
          "Bean secure messaging requires a secure browser context."
      }
    );
  }


  if (
    typeof globalThis.crypto !==
      "object"
  ) {
    throw createError(
      "CRYPTO_NOT_READY",
      "crypto",
      {
        message:
          "Web Crypto is unavailable."
      }
    );
  }


  if (
    typeof crypto.getRandomValues !==
      "function"
  ) {
    throw createError(
      "CRYPTO_NOT_READY",
      "crypto",
      {
        message:
          "Secure random generation is unavailable."
      }
    );
  }


  if (
    typeof crypto.subtle !==
      "object"
  ) {
    throw createError(
      "CRYPTO_NOT_READY",
      "crypto",
      {
        message:
          "SubtleCrypto is unavailable."
      }
    );
  }
}


/* ============================================================
   ENVELOPE VALIDATION

   Encrypted payload must be structured JSON.

   We deliberately do not assume:
   IV
   nonce
   AES mode
   RSA key
   ratchet format
   MLS format

   Those belong to the audited crypto provider.
   ============================================================ */

function validateEnvelope(
  envelope:
    SecureMessageEnvelope
): SecureMessageEnvelope {
  if (
    typeof envelope !==
      "object" ||
    envelope === null ||
    Array.isArray(
      envelope
    )
  ) {
    throw createError(
      "CRYPTO_ENCRYPT_FAILED",
      "crypto",
      {
        message:
          "Crypto provider returned an invalid encrypted envelope."
      }
    );
  }


  const keys =
    Object.keys(
      envelope
    );


  if (
    keys.length === 0
  ) {
    throw createError(
      "CRYPTO_ENCRYPT_FAILED",
      "crypto",
      {
        message:
          "Encrypted envelope cannot be empty."
      }
    );
  }


  /*
   * Ensure the encrypted envelope can safely pass through
   * Postgres JSON/JSONB without hidden browser objects.
   */
  try {
    const serialized =
      JSON.stringify(
        envelope
      );


    if (
      typeof serialized !==
        "string" ||
      serialized.length === 0
    ) {
      throw new Error(
        "Envelope serialization failed."
      );
    }


    return JSON.parse(
      serialized
    ) as SecureMessageEnvelope;
  } catch (error) {
    throw createError(
      "CRYPTO_ENCRYPT_FAILED",
      "crypto",
      {
        message:
          "Encrypted envelope is not JSON serializable.",

        cause:
          error
      }
    );
  }
}


/* ============================================================
   MESSAGE PROVIDER BRIDGE

   messages.ts sees only the stable MessageCryptoProvider
   contract.

   It never needs to know which protocol Bean uses.
   ============================================================ */

const messageCryptoBridge:
  MessageCryptoProvider = {
    async encryptText(
      input
    ): Promise<SecureMessageEnvelope> {
      const adapter =
        requireReadyCryptoAdapter();


      let envelope:
        SecureMessageEnvelope;


      try {
        envelope =
          await adapter.encryptText(
            input
          );
      } catch (error) {
        throw createError(
          "CRYPTO_ENCRYPT_FAILED",
          "crypto",
          {
            cause:
              error,

            context: {
              conversationId:
                input.conversationId,

              clientMessageId:
                input.clientMessageId
            }
          }
        );
      }


      return validateEnvelope(
        envelope
      );
    },


    async decryptText(
      input
    ): Promise<string> {
      const adapter =
        requireReadyCryptoAdapter();


      try {
        const plaintext =
          await adapter.decryptText(
            {
              ...input,

              envelope:
                validateEnvelope(
                  input.envelope
                )
            }
          );


        if (
          typeof plaintext !==
            "string"
        ) {
          throw createError(
            "CRYPTO_DECRYPT_FAILED",
            "crypto",
            {
              message:
                "Crypto provider returned invalid plaintext."
            }
          );
        }


        return plaintext;
      } catch (error) {
        throw normalizeError(
          error,
          {
            source:
              "crypto",

            fallbackCode:
              "CRYPTO_DECRYPT_FAILED",

            context: {
              conversationId:
                input.conversationId,

              messageId:
                input.messageId,

              senderId:
                input.senderId
            }
          }
        );
      }
    }
  };


/* ============================================================
   REQUIRE READY ADAPTER
   ============================================================ */

function requireReadyCryptoAdapter():
  BeanCryptoAdapter {
  if (
    runtimeState.status !==
      "ready" ||
    !activeAdapter ||
    !activeAdapter.isReady()
  ) {
    throw createError(
      "CRYPTO_NOT_READY",
      "crypto"
    );
  }


  return activeAdapter;
}


/* ============================================================
   INITIALIZATION

   Fail-closed behavior:

   missing adapter
       ↓
   crypto unavailable
       ↓
   messages.ts has no provider
       ↓
   sending blocked
   ============================================================ */

let initializationPromise:
  Promise<void> | null = null;


async function performInitialization():
  Promise<void> {
  runtimeState.status =
    "initializing";

  runtimeState.lastError =
    null;


  emitCryptoEvent(
    "bean:crypto-initializing"
  );


  try {
    assertSecureBrowserRuntime();


    if (!activeAdapter) {
      throw createError(
        "CRYPTO_NOT_READY",
        "crypto",
        {
          message:
            "No audited Bean crypto provider has been registered."
        }
      );
    }


    await activeAdapter.initialize();


    if (
      !activeAdapter.isReady()
    ) {
      throw createError(
        "CRYPTO_NOT_READY",
        "crypto",
        {
          message:
            "Crypto provider initialized but is not ready."
        }
      );
    }


    /*
     * Only after successful initialization do messages
     * receive access to encryption/decryption.
     */
    setMessageCryptoProvider(
      messageCryptoBridge
    );


    runtimeState.status =
      "ready";

    runtimeState.initializedAt =
      Date.now();

    runtimeState.providerName =
      activeAdapter.info.name;

    runtimeState.providerVersion =
      activeAdapter.info.version;


    emitCryptoEvent(
      "bean:crypto-ready",
      {
        provider: {
          name:
            activeAdapter.info.name,

          version:
            activeAdapter.info.version
        }
      }
    );
  } catch (error) {
    const normalized =
      normalizeError(
        error,
        {
          source:
            "crypto",

          fallbackCode:
            "CRYPTO_NOT_READY"
        }
      );


    runtimeState.status =
      "failed";

    runtimeState.lastError =
      normalized;


    /*
     * Critical:
     * remove provider bridge on every initialization failure.
     */
    setMessageCryptoProvider(
      null
    );


    emitCryptoEvent(
      "bean:crypto-failed",
      {
        error:
          normalized
      }
    );


    throw normalized;
  }
}


export async function initializeCrypto():
  Promise<void> {
  if (
    runtimeState.status ===
      "ready"
  ) {
    return;
  }


  if (
    initializationPromise
  ) {
    return initializationPromise;
  }


  initializationPromise =
    performInitialization();


  try {
    await initializationPromise;
  } finally {
    initializationPromise =
      null;
  }
}


/* ============================================================
   READY CHECK
   ============================================================ */

export function isCryptoReady():
  boolean {
  return (
    runtimeState.status ===
      "ready" &&
    activeAdapter !== null &&
    activeAdapter.isReady()
  );
}


/* ============================================================
   LOCK

   Used when:
   - device locks
   - user explicitly locks Bean
   - sensitive key material should leave active memory

   Provider remains registered but unusable.
   ============================================================ */

export async function lockCrypto():
  Promise<void> {
  const adapter =
    activeAdapter;


  /*
   * Disconnect messages first.
   */
  setMessageCryptoProvider(
    null
  );


  if (
    adapter?.lock
  ) {
    try {
      await adapter.lock();
    } catch (error) {
      console.warn(
        "[Bean:crypto] Provider lock failed.",
        normalizeError(
          error,
          {
            source:
              "crypto"
          }
        )
      );
    }
  }


  runtimeState.status =
    "locked";


  emitCryptoEvent(
    "bean:crypto-locked"
  );
}


/* ============================================================
   RESET

   Used on:
   - logout
   - account replacement
   - crypto identity reset

   Does NOT automatically delete persistent device keys.
   Provider-specific secure key deletion must be explicit
   inside the audited adapter.
   ============================================================ */

export async function resetCrypto():
  Promise<void> {
  setMessageCryptoProvider(
    null
  );


  const adapter =
    activeAdapter;


  if (
    adapter?.reset
  ) {
    try {
      await adapter.reset();
    } catch (error) {
      console.warn(
        "[Bean:crypto] Provider reset failed.",
        normalizeError(
          error,
          {
            source:
              "crypto"
          }
        )
      );
    }
  }


  activeAdapter =
    null;


  runtimeState.status =
    "idle";

  runtimeState.initializedAt =
    null;

  runtimeState.providerName =
    null;

  runtimeState.providerVersion =
    null;

  runtimeState.lastError =
    null;


  emitCryptoEvent(
    "bean:crypto-reset"
  );
}


/* ============================================================
   SECURE RANDOM BYTES

   Utility available to audited provider adapters.

   Never use Math.random() for cryptographic material.
   ============================================================ */

export function secureRandomBytes(
  length: number
): Uint8Array {
  if (
    !Number.isInteger(length) ||
    length <= 0 ||
    length > 65_536
  ) {
    throw createError(
      "INVALID_INPUT",
      "crypto",
      {
        message:
          "Invalid secure random byte length."
      }
    );
  }


  assertSecureBrowserRuntime();


  const bytes =
    new Uint8Array(
      length
    );


  crypto.getRandomValues(
    bytes
  );


  return bytes;
}


/* ============================================================
   MEMORY ZEROING

   Best-effort only.

   JavaScript runtimes can copy memory internally, therefore
   this must never be treated as guaranteed secure erasure.
   ============================================================ */

export function zeroBytes(
  value: Uint8Array
): void {
  value.fill(
    0
  );
}
