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
  getOwnMembership
} from "./conversations";


/* ============================================================
   BEAN — SIGNATURESI
   Media Module

   Responsibilities:
   - Validate encrypted attachment payloads
   - Upload encrypted media to private Supabase Storage
   - Create media object metadata
   - Generate short-lived private download URLs
   - Download encrypted media
   - Delete owned media safely
   - Keep storage paths isolated by UUID

   Must NOT own:
   - File picker UI
   - Image/video rendering
   - Message sending
   - Encryption algorithms
   - Thumbnail generation
   - Virus scanning implementation
   - Public Storage URLs

   SECURITY:
   - bean-media bucket is PRIVATE
   - plaintext attachments must never be uploaded
   - storage paths use immutable UUIDs
   - upsert is disabled
   - signed URLs are short-lived
   ============================================================ */


/* ============================================================
   STORAGE
   ============================================================ */

const MEDIA_BUCKET =
  "bean-media";


/*
 * Current Bean production bucket limit:
 * 100 MiB.
 */
const MAX_MEDIA_BYTES =
  100 * 1024 * 1024;


const DEFAULT_SIGNED_URL_SECONDS =
  60;


const MAX_SIGNED_URL_SECONDS =
  15 * 60;


/* ============================================================
   TYPES
   ============================================================ */

export type MediaKind =
  | "image"
  | "video"
  | "audio"
  | "voice"
  | "file";


export type MediaObjectStatus =
  | "ready"
  | "deleted";


export interface MediaObject {
  id: string;

  conversationId: string;

  ownerId: string;

  kind: MediaKind;

  bucket: string;

  storagePath: string;

  ciphertextSize: number;

  status: MediaObjectStatus;

  createdAt: string;

  deletedAt: string | null;
}


/*
 * This is already encrypted data.

 * crypto.ts / the audited E2EE provider will eventually
 * produce this object before media.ts receives it.
 */
export interface EncryptedMediaPayload {
  blob: Blob;

  kind: MediaKind;

  /*
   * Opaque encrypted metadata may contain:
   * - original filename
   * - original MIME type
   * - dimensions
   * - duration
   * - encryption information
   *
   * media.ts never interprets it.
   */
  encryptedMetadata:
    Readonly<Record<string, unknown>>;
}


export interface UploadEncryptedMediaInput {
  conversationId: string;

  payload: EncryptedMediaPayload;
}


export interface UploadedMedia {
  object: MediaObject;

  encryptedMetadata:
    Readonly<Record<string, unknown>>;
}


export interface MediaDownload {
  blob: Blob;

  object: MediaObject;
}


/* ============================================================
   DATABASE ROW
   ============================================================ */

interface MediaObjectRow {
  id: string;

  conversation_id: string;

  owner_id: string;

  kind: MediaKind;

  bucket: string;

  storage_path: string;

  ciphertext_size: number;

  status: MediaObjectStatus;

  created_at: string;

  deleted_at: string | null;
}


/* ============================================================
   ROW MAPPER
   ============================================================ */

function mapMediaObject(
  row: MediaObjectRow
): MediaObject {
  return {
    id:
      row.id,

    conversationId:
      row.conversation_id,

    ownerId:
      row.owner_id,

    kind:
      row.kind,

    bucket:
      row.bucket,

    storagePath:
      row.storage_path,

    ciphertextSize:
      row.ciphertext_size,

    status:
      row.status,

    createdAt:
      row.created_at,

    deletedAt:
      row.deleted_at
  };
}


/* ============================================================
   UUID
   ============================================================ */

function createObjectId():
  string {
  if (
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }


  throw createError(
    "NOT_SUPPORTED",
    "media",
    {
      message:
        "Secure UUID generation is unavailable."
    }
  );
}


/* ============================================================
   ACCESS CHECK
   ============================================================ */

async function requireConversationAccess(
  conversationId: string
): Promise<void> {
  const membership =
    await getOwnMembership(
      conversationId
    );


  if (!membership) {
    throw createError(
      "CONVERSATION_FORBIDDEN",
      "media",
      {
        context: {
          conversationId
        }
      }
    );
  }
}


/* ============================================================
   ENCRYPTED PAYLOAD VALIDATION
   ============================================================ */

function validateEncryptedPayload(
  payload: EncryptedMediaPayload
): void {
  if (
    !(payload.blob instanceof Blob)
  ) {
    throw createError(
      "MEDIA_INVALID_FILE",
      "media",
      {
        message:
          "Encrypted media payload is invalid."
      }
    );
  }


  if (
    payload.blob.size <= 0
  ) {
    throw createError(
      "MEDIA_INVALID_FILE",
      "media",
      {
        message:
          "Encrypted media payload is empty."
      }
    );
  }


  if (
    payload.blob.size >
      MAX_MEDIA_BYTES
  ) {
    throw createError(
      "MEDIA_FILE_TOO_LARGE",
      "media",
      {
        context: {
          size:
            payload.blob.size,

          limit:
            MAX_MEDIA_BYTES
        }
      }
    );
  }


  if (
    typeof payload.encryptedMetadata !==
      "object" ||
    payload.encryptedMetadata ===
      null ||
    Array.isArray(
      payload.encryptedMetadata
    )
  ) {
    throw createError(
      "MEDIA_INVALID_FILE",
      "media",
      {
        message:
          "Encrypted media metadata is invalid."
      }
    );
  }


  /*
   * Ensure metadata can safely travel inside the
   * encrypted message envelope later.
   */
  try {
    JSON.stringify(
      payload.encryptedMetadata
    );
  } catch (error) {
    throw createError(
      "MEDIA_INVALID_FILE",
      "media",
      {
        message:
          "Encrypted media metadata is not serializable.",

        cause:
          error
      }
    );
  }
}


/* ============================================================
   STORAGE PATH

   Never use:
   - username
   - bean@username
   - original filename

   Example:

   users/<UUID>/conversations/<UUID>/<object UUID>.bin
   ============================================================ */

function createStoragePath(
  userId: string,
  conversationId: string,
  objectId: string
): string {
  return [
    "users",
    userId,
    "conversations",
    conversationId,
    `${objectId}.bin`
  ].join("/");
}


/* ============================================================
   GET MEDIA OBJECT
   ============================================================ */

export async function getMediaObjectById(
  mediaId: string
): Promise<MediaObject | null> {
  requireAuthenticatedUser();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_media_objects"
        )
        .select(
          `
            id,
            conversation_id,
            owner_id,
            kind,
            bucket,
            storage_path,
            ciphertext_size,
            status,
            created_at,
            deleted_at
          `
        )
        .eq(
          "id",
          mediaId
        )
        .maybeSingle<MediaObjectRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapMediaObject(
          data
        )
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "media",

        fallbackCode:
          "MEDIA_DOWNLOAD_FAILED",

        context: {
          operation:
            "getMediaObjectById",

          mediaId
        }
      }
    );
  }
}


/* ============================================================
   UPLOAD ENCRYPTED MEDIA

   Order:

   verify membership
       ↓
   validate ciphertext
       ↓
   generate UUID/path
       ↓
   upload ciphertext
       ↓
   create DB metadata

   If DB insert fails:
   Storage object is rolled back.
   ============================================================ */

export async function uploadEncryptedMedia(
  input: UploadEncryptedMediaInput
): Promise<UploadedMedia> {
  const account =
    requireAuthenticatedUser();


  const conversationId =
    input.conversationId.trim();


  if (!conversationId) {
    throw createError(
      "INVALID_INPUT",
      "media",
      {
        message:
          "Conversation ID is required."
      }
    );
  }


  await requireConversationAccess(
    conversationId
  );


  validateEncryptedPayload(
    input.payload
  );


  const objectId =
    createObjectId();


  const storagePath =
    createStoragePath(
      account.id,
      conversationId,
      objectId
    );


  /*
   * Ciphertext is intentionally stored as generic binary.
   *
   * Plaintext MIME information can remain inside encrypted
   * metadata instead of leaking into Storage metadata.
   */
  const storageBlob =
    input.payload.blob.type ===
      "application/octet-stream"
      ? input.payload.blob
      : new Blob(
          [
            input.payload.blob
          ],
          {
            type:
              "application/octet-stream"
          }
        );


  try {
    const {
      error: uploadError
    } =
      await supabase.storage
        .from(
          MEDIA_BUCKET
        )
        .upload(
          storagePath,
          storageBlob,
          {
            contentType:
              "application/octet-stream",

            cacheControl:
              "3600",

            upsert:
              false
          }
        );


    if (uploadError) {
      throw uploadError;
    }
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "media",

        fallbackCode:
          "MEDIA_UPLOAD_FAILED",

        context: {
          operation:
            "uploadEncryptedMedia.storage",

          conversationId,

          objectId
        }
      }
    );
  }


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_media_objects"
        )
        .insert({
          id:
            objectId,

          conversation_id:
            conversationId,

          owner_id:
            account.id,

          kind:
            input.payload.kind,

          bucket:
            MEDIA_BUCKET,

          storage_path:
            storagePath,

          ciphertext_size:
            storageBlob.size,

          status:
            "ready"
        })
        .select(
          `
            id,
            conversation_id,
            owner_id,
            kind,
            bucket,
            storage_path,
            ciphertext_size,
            status,
            created_at,
            deleted_at
          `
        )
        .single<MediaObjectRow>();


    if (error) {
      throw error;
    }


    return {
      object:
        mapMediaObject(
          data
        ),

      encryptedMetadata:
        input.payload
          .encryptedMetadata
    };
  } catch (error) {
    /*
     * Database registration failed.
     *
     * Do not intentionally leave an orphaned ciphertext
     * object in Storage.
     */
    try {
      await supabase.storage
        .from(
          MEDIA_BUCKET
        )
        .remove([
          storagePath
        ]);
    } catch {
      /*
       * Cleanup can also be handled later by an orphan
       * sweeper/server job.
       */
    }


    throw normalizeError(
      error,
      {
        source:
          "media",

        fallbackCode:
          "MEDIA_UPLOAD_FAILED",

        context: {
          operation:
            "uploadEncryptedMedia.metadata",

          conversationId,

          objectId
        }
      }
    );
  }
}


/* ============================================================
   DOWNLOAD ENCRYPTED MEDIA

   Returns ciphertext Blob.

   Decryption remains crypto provider responsibility.
   ============================================================ */

export async function downloadEncryptedMedia(
  mediaId: string
): Promise<MediaDownload> {
  requireAuthenticatedUser();


  const object =
    await getMediaObjectById(
      mediaId
    );


  if (
    !object ||
    object.status !==
      "ready" ||
    object.deletedAt
  ) {
    throw createError(
      "MEDIA_DOWNLOAD_FAILED",
      "media",
      {
        message:
          "Media object is unavailable.",

        context: {
          mediaId
        }
      }
    );
  }


  await requireConversationAccess(
    object.conversationId
  );


  try {
    const {
      data,
      error
    } =
      await supabase.storage
        .from(
          object.bucket
        )
        .download(
          object.storagePath
        );


    if (error) {
      throw error;
    }


    return {
      blob:
        data,

      object
    };
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "media",

        fallbackCode:
          "MEDIA_DOWNLOAD_FAILED",

        context: {
          operation:
            "downloadEncryptedMedia",

          mediaId,

          conversationId:
            object.conversationId
        }
      }
    );
  }
}


/* ============================================================
   SHORT-LIVED SIGNED URL

   Useful for:
   - streaming large encrypted media
   - native browser media fetch
   - download workers

   URL still points only to ciphertext.
   ============================================================ */

export async function createMediaSignedUrl(
  mediaId: string,
  expiresInSeconds =
    DEFAULT_SIGNED_URL_SECONDS
): Promise<string> {
  requireAuthenticatedUser();


  const object =
    await getMediaObjectById(
      mediaId
    );


  if (
    !object ||
    object.status !==
      "ready" ||
    object.deletedAt
  ) {
    throw createError(
      "MEDIA_DOWNLOAD_FAILED",
      "media",
      {
        message:
          "Media object is unavailable."
      }
    );
  }


  await requireConversationAccess(
    object.conversationId
  );


  const expiresIn =
    Math.max(
      1,
      Math.min(
        MAX_SIGNED_URL_SECONDS,
        Math.floor(
          expiresInSeconds
        )
      )
    );


  try {
    const {
      data,
      error
    } =
      await supabase.storage
        .from(
          object.bucket
        )
        .createSignedUrl(
          object.storagePath,
          expiresIn
        );


    if (error) {
      throw error;
    }


    if (
      !data.signedUrl
    ) {
      throw createError(
        "MEDIA_DOWNLOAD_FAILED",
        "media",
        {
          message:
            "Signed media URL was not returned."
        }
      );
    }


    return data.signedUrl;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "media",

        fallbackCode:
          "MEDIA_DOWNLOAD_FAILED",

        context: {
          operation:
            "createMediaSignedUrl",

          mediaId
        }
      }
    );
  }
}


/* ============================================================
   DELETE MEDIA

   Only the owner may initiate client-side deletion.

   RLS must independently enforce this in database/storage.
   ============================================================ */

export async function deleteOwnMedia(
  mediaId: string
): Promise<void> {
  const account =
    requireAuthenticatedUser();


  const object =
    await getMediaObjectById(
      mediaId
    );


  if (!object) {
    return;
  }


  if (
    object.ownerId !==
      account.id
  ) {
    throw createError(
      "PERMISSION_DENIED",
      "media"
    );
  }


  if (
    object.status ===
      "deleted"
  ) {
    return;
  }


  /*
   * Tombstone metadata first.

   * If Storage deletion temporarily fails, access can still
   * be denied at the application/database level and cleanup
   * retried server-side.
   */
  try {
    const {
      error
    } =
      await supabase
        .from(
          "bean_media_objects"
        )
        .update({
          status:
            "deleted",

          deleted_at:
            new Date()
              .toISOString()
        })
        .eq(
          "id",
          mediaId
        )
        .eq(
          "owner_id",
          account.id
        );


    if (error) {
      throw error;
    }
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "media",

        fallbackCode:
          "MEDIA_UPLOAD_FAILED",

        context: {
          operation:
            "deleteOwnMedia.metadata",

          mediaId
        }
      }
    );
  }


  try {
    const {
      error
    } =
      await supabase.storage
        .from(
          object.bucket
        )
        .remove([
          object.storagePath
        ]);


    if (error) {
      throw error;
    }
  } catch (error) {
    /*
     * Metadata is already tombstoned.
     * Physical cleanup can be retried later.
     */
    console.warn(
      "[Bean:media] Physical media cleanup failed.",
      normalizeError(
        error,
        {
          source:
            "media",

          context: {
            mediaId,

            storagePath:
              object.storagePath
          }
        }
      )
    );
  }
}


/* ============================================================
   LIMIT HELPERS
   ============================================================ */

export function getMaximumMediaSize():
  number {
  return MAX_MEDIA_BYTES;
}


export function isMediaSizeAllowed(
  size: number
): boolean {
  return (
    Number.isFinite(size) &&
    size > 0 &&
    size <= MAX_MEDIA_BYTES
  );
}
