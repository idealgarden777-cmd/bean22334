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
  getConversationById,
  getOwnMembership
} from "./conversations";


/* ============================================================
   BEAN — SIGNATURESI
   Messages Module

   Responsibilities:
   - Load paginated conversation messages
   - Send encrypted messages
   - Decrypt messages through crypto provider
   - Edit own messages
   - Soft-delete / tombstone own messages
   - Manage reactions
   - Handle disappearing-message expiry metadata
   - Provide stable message domain contracts

   Must NOT own:
   - Cryptographic implementation
   - Realtime subscriptions
   - Presence / typing
   - File upload transport
   - Notifications
   - UI rendering

   SECURITY:
   - No plaintext fallback
   - Message content never enters metadata
   - Crypto provider must be registered before sending
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;

const MAX_TEXT_LENGTH = 50_000;

const MAX_REACTION_LENGTH = 64;


/* ============================================================
   MESSAGE TYPES
   ============================================================ */

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "voice"
  | "file"
  | "location"
  | "contact"
  | "poll"
  | "beanmoji"
  | "system"
  | "call";


export interface SecureMessageEnvelope {
  readonly [key: string]: unknown;
}


export interface Message {
  id: string;

  clientMessageId: string;

  conversationId: string;

  senderId: string;

  type: MessageType;

  ciphertext: SecureMessageEnvelope;

  metadata: Readonly<Record<string, unknown>>;

  replyTo: string | null;

  editedAt: string | null;

  deletedAt: string | null;

  expiresAt: string | null;

  createdAt: string;
}


export interface DecryptedMessage
  extends Message {
  content: string | null;

  decryptionFailed: boolean;
}


export interface MessageReaction {
  messageId: string;

  userId: string;

  reaction: string;

  createdAt: string;

  updatedAt: string;
}


export interface MessageCursor {
  createdAt: string;

  id: string;
}


export interface MessagePage {
  messages: Message[];

  nextCursor: MessageCursor | null;

  hasMore: boolean;
}


/* ============================================================
   INPUT TYPES
   ============================================================ */

export interface SendTextMessageInput {
  conversationId: string;

  text: string;

  replyTo?: string | null;

  expiresAt?: string | null;

  metadata?: Readonly<
    Record<string, unknown>
  >;
}


export interface EditTextMessageInput {
  messageId: string;

  text: string;
}


export interface LoadMessagesInput {
  conversationId: string;

  cursor?: MessageCursor | null;

  limit?: number;
}


/* ============================================================
   CRYPTO PROVIDER CONTRACT

   crypto.ts will register the real implementation later.

   messages.ts only knows:
   plain text in
       ↓
   encrypted JSON envelope out

   and:
   encrypted JSON envelope
       ↓
   decrypted text out
   ============================================================ */

export interface MessageCryptoProvider {
  encryptText(
    input: {
      conversationId: string;

      clientMessageId: string;

      plaintext: string;
    }
  ): Promise<SecureMessageEnvelope>;


  decryptText(
    input: {
      conversationId: string;

      messageId: string;

      senderId: string;

      envelope: SecureMessageEnvelope;
    }
  ): Promise<string>;
}


let cryptoProvider:
  MessageCryptoProvider | null = null;


/**
 * crypto.ts calls this once its secure runtime is ready.
 */
export function setMessageCryptoProvider(
  provider: MessageCryptoProvider | null
): void {
  cryptoProvider =
    provider;
}


function requireCryptoProvider():
  MessageCryptoProvider {
  if (!cryptoProvider) {
    throw createError(
      "CRYPTO_NOT_READY",
      "messages",
      {
        message:
          "Secure messaging provider has not been initialized."
      }
    );
  }


  return cryptoProvider;
}


/* ============================================================
   DATABASE ROW TYPES
   ============================================================ */

interface MessageRow {
  id: string;

  client_message_id: string;

  conversation_id: string;

  sender_id: string;

  message_type: MessageType;

  ciphertext: unknown;

  metadata: unknown;

  reply_to: string | null;

  edited_at: string | null;

  deleted_at: string | null;

  expires_at: string | null;

  created_at: string;
}


interface ReactionRow {
  message_id: string;

  user_id: string;

  reaction: string;

  created_at: string;

  updated_at: string;
}


/* ============================================================
   ROW HELPERS
   ============================================================ */

function asRecord(
  value: unknown
): Readonly<Record<string, unknown>> {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as
      Readonly<Record<string, unknown>>;
  }


  return Object.freeze({});
}


function mapMessage(
  row: MessageRow
): Message {
  return {
    id:
      row.id,

    clientMessageId:
      row.client_message_id,

    conversationId:
      row.conversation_id,

    senderId:
      row.sender_id,

    type:
      row.message_type,

    ciphertext:
      asRecord(
        row.ciphertext
      ),

    metadata:
      asRecord(
        row.metadata
      ),

    replyTo:
      row.reply_to,

    editedAt:
      row.edited_at,

    deletedAt:
      row.deleted_at,

    expiresAt:
      row.expires_at,

    createdAt:
      row.created_at
  };
}


function mapReaction(
  row: ReactionRow
): MessageReaction {
  return {
    messageId:
      row.message_id,

    userId:
      row.user_id,

    reaction:
      row.reaction,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


/* ============================================================
   INPUT VALIDATION
   ============================================================ */

function validateText(
  value: string
): string {
  const text =
    value.trim();


  if (!text) {
    throw createError(
      "INVALID_INPUT",
      "messages",
      {
        message:
          "Message cannot be empty."
      }
    );
  }


  if (
    text.length >
      MAX_TEXT_LENGTH
  ) {
    throw createError(
      "INVALID_INPUT",
      "messages",
      {
        message:
          `Message exceeds ${MAX_TEXT_LENGTH} characters.`
      }
    );
  }


  return text;
}


function normalizePageSize(
  value: number | undefined
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_PAGE_SIZE;
  }


  return Math.max(
    1,
    Math.min(
      MAX_PAGE_SIZE,
      Math.floor(value)
    )
  );
}


function validateOptionalDate(
  value: string | null | undefined
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }


  const timestamp =
    Date.parse(value);


  if (
    Number.isNaN(timestamp)
  ) {
    throw createError(
      "INVALID_INPUT",
      "messages",
      {
        message:
          "Invalid message expiry date."
      }
    );
  }


  return new Date(
    timestamp
  ).toISOString();
}


/* ============================================================
   ACCESS CHECK
   ============================================================ */

async function requireConversationAccess(
  conversationId: string
): Promise<void> {
  const conversation =
    await getConversationById(
      conversationId
    );


  if (!conversation) {
    throw createError(
      "CONVERSATION_NOT_FOUND",
      "messages",
      {
        context: {
          conversationId
        }
      }
    );
  }


  const membership =
    await getOwnMembership(
      conversationId
    );


  if (!membership) {
    throw createError(
      "CONVERSATION_FORBIDDEN",
      "messages",
      {
        context: {
          conversationId
        }
      }
    );
  }
}


/* ============================================================
   GET ONE MESSAGE
   ============================================================ */

export async function getMessageById(
  messageId: string
): Promise<Message | null> {
  requireAuthenticatedUser();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_messages"
        )
        .select(
          `
            id,
            client_message_id,
            conversation_id,
            sender_id,
            message_type,
            ciphertext,
            metadata,
            reply_to,
            edited_at,
            deleted_at,
            expires_at,
            created_at
          `
        )
        .eq(
          "id",
          messageId
        )
        .maybeSingle<MessageRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapMessage(data)
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "messages",

        fallbackCode:
          "MESSAGE_NOT_FOUND",

        context: {
          operation:
            "getMessageById",

          messageId
        }
      }
    );
  }
}


/* ============================================================
   LOAD MESSAGE PAGE

   Cursor pagination:
   newest first from database.

   UI can reverse the returned array for chronological
   top-to-bottom rendering.

   We request pageSize + 1 so we can determine hasMore
   without a separate COUNT query.
   ============================================================ */

export async function loadMessages(
  input: LoadMessagesInput
): Promise<MessagePage> {
  requireAuthenticatedUser();


  await requireConversationAccess(
    input.conversationId
  );


  const pageSize =
    normalizePageSize(
      input.limit
    );


  try {
    let query =
      supabase
        .from(
          "bean_messages"
        )
        .select(
          `
            id,
            client_message_id,
            conversation_id,
            sender_id,
            message_type,
            ciphertext,
            metadata,
            reply_to,
            edited_at,
            deleted_at,
            expires_at,
            created_at
          `
        )
        .eq(
          "conversation_id",
          input.conversationId
        );


    /*
     * Composite cursor protects against messages having
     * identical created_at timestamps.
     */
    if (input.cursor) {
      query =
        query.or(
          [
            `created_at.lt.${input.cursor.createdAt}`,
            `and(created_at.eq.${input.cursor.createdAt},id.lt.${input.cursor.id})`
          ].join(",")
        );
    }


    const {
      data,
      error
    } =
      await query
        .order(
          "created_at",
          {
            ascending:
              false
          }
        )
        .order(
          "id",
          {
            ascending:
              false
          }
        )
        .limit(
          pageSize + 1
        );


    if (error) {
      throw error;
    }


    const rows =
      (
        data as
          MessageRow[] | null
      ) ?? [];


    const hasMore =
      rows.length >
        pageSize;


    const pageRows =
      hasMore
        ? rows.slice(
            0,
            pageSize
          )
        : rows;


    const messages =
      pageRows.map(
        mapMessage
      );


    const lastMessage =
      messages[
        messages.length - 1
      ];


    const nextCursor =
      hasMore &&
      lastMessage
        ? {
            createdAt:
              lastMessage.createdAt,

            id:
              lastMessage.id
          }
        : null;


    return {
      messages,

      nextCursor,

      hasMore
    };
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "messages",

        context: {
          operation:
            "loadMessages",

          conversationId:
            input.conversationId
        }
      }
    );
  }
}


/* ============================================================
   SEND TEXT MESSAGE

   SECURITY:
   Encrypt BEFORE database insert.

   No crypto provider
      ↓
   no send

   Encryption failure
      ↓
   no send
   ============================================================ */

export async function sendTextMessage(
  input: SendTextMessageInput
): Promise<Message> {
  const account =
    requireAuthenticatedUser();


  const text =
    validateText(
      input.text
    );


  await requireConversationAccess(
    input.conversationId
  );


  const crypto =
    requireCryptoProvider();


  const clientMessageId =
    cryptoRandomUuid();


  let ciphertext:
    SecureMessageEnvelope;


  try {
    ciphertext =
      await crypto.encryptText({
        conversationId:
          input.conversationId,

        clientMessageId,

        plaintext:
          text
      });
  } catch (error) {
    throw createError(
      "CRYPTO_ENCRYPT_FAILED",
      "messages",
      {
        cause:
          error,

        context: {
          conversationId:
            input.conversationId,

          clientMessageId
        }
      }
    );
  }


  const expiresAt =
    validateOptionalDate(
      input.expiresAt
    );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_messages"
        )
        .insert({
          client_message_id:
            clientMessageId,

          conversation_id:
            input.conversationId,

          sender_id:
            account.id,

          message_type:
            "text",

          ciphertext,

          metadata:
            input.metadata
              ? {
                  ...input.metadata
                }
              : {},

          reply_to:
            input.replyTo ??
            null,

          expires_at:
            expiresAt
        })
        .select(
          `
            id,
            client_message_id,
            conversation_id,
            sender_id,
            message_type,
            ciphertext,
            metadata,
            reply_to,
            edited_at,
            deleted_at,
            expires_at,
            created_at
          `
        )
        .single<MessageRow>();


    if (error) {
      throw error;
    }


    return mapMessage(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "messages",

        fallbackCode:
          "MESSAGE_SEND_FAILED",

        context: {
          operation:
            "sendTextMessage",

          conversationId:
            input.conversationId,

          clientMessageId
        }
      }
    );
  }
}


/* ============================================================
   DECRYPT MESSAGE

   Deleted messages are never passed to crypto.
   ============================================================ */

export async function decryptMessage(
  message: Message
): Promise<DecryptedMessage> {
  if (
    message.deletedAt
  ) {
    return {
      ...message,

      content:
        null,

      decryptionFailed:
        false
    };
  }


  /*
   * Non-text message-specific decoding will be added
   * by media / beanmoji modules later.
   */
  if (
    message.type !==
      "text"
  ) {
    return {
      ...message,

      content:
        null,

      decryptionFailed:
        false
    };
  }


  const crypto =
    requireCryptoProvider();


  try {
    const content =
      await crypto.decryptText({
        conversationId:
          message.conversationId,

        messageId:
          message.id,

        senderId:
          message.senderId,

        envelope:
          message.ciphertext
      });


    return {
      ...message,

      content,

      decryptionFailed:
        false
    };
  } catch {
    return {
      ...message,

      content:
        null,

      decryptionFailed:
        true
    };
  }
}


/* ============================================================
   DECRYPT PAGE
   ============================================================ */

export async function decryptMessages(
  messages: readonly Message[]
): Promise<DecryptedMessage[]> {
  return Promise.all(
    messages.map(
      decryptMessage
    )
  );
}


/* ============================================================
   EDIT OWN TEXT MESSAGE

   Message is re-encrypted.
   Plaintext is never written to DB.
   ============================================================ */

export async function editTextMessage(
  input: EditTextMessageInput
): Promise<Message> {
  const account =
    requireAuthenticatedUser();


  const text =
    validateText(
      input.text
    );


  const existing =
    await getMessageById(
      input.messageId
    );


  if (!existing) {
    throw createError(
      "MESSAGE_NOT_FOUND",
      "messages"
    );
  }


  if (
    existing.senderId !==
      account.id
  ) {
    throw createError(
      "PERMISSION_DENIED",
      "messages"
    );
  }


  if (
    existing.deletedAt
  ) {
    throw createError(
      "MESSAGE_NOT_FOUND",
      "messages",
      {
        message:
          "Deleted messages cannot be edited."
      }
    );
  }


  if (
    existing.type !==
      "text"
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "messages",
      {
        message:
          "This message type cannot be edited as text."
      }
    );
  }


  const crypto =
    requireCryptoProvider();


  let ciphertext:
    SecureMessageEnvelope;


  try {
    ciphertext =
      await crypto.encryptText({
        conversationId:
          existing.conversationId,

        clientMessageId:
          existing.clientMessageId,

        plaintext:
          text
      });
  } catch (error) {
    throw createError(
      "CRYPTO_ENCRYPT_FAILED",
      "messages",
      {
        cause:
          error,

        context: {
          messageId:
            existing.id
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
          "bean_messages"
        )
        .update({
          ciphertext,

          edited_at:
            new Date()
              .toISOString()
        })
        .eq(
          "id",
          existing.id
        )
        .eq(
          "sender_id",
          account.id
        )
        .select(
          `
            id,
            client_message_id,
            conversation_id,
            sender_id,
            message_type,
            ciphertext,
            metadata,
            reply_to,
            edited_at,
            deleted_at,
            expires_at,
            created_at
          `
        )
        .single<MessageRow>();


    if (error) {
      throw error;
    }


    return mapMessage(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "messages",

        fallbackCode:
          "MESSAGE_EDIT_FAILED",

        context: {
          operation:
            "editTextMessage",

          messageId:
            existing.id
        }
      }
    );
  }
}


/* ============================================================
   SOFT DELETE / TOMBSTONE

   We do NOT:
   delete row
   save row client-side
   reinsert it on undo

   Conversation chronology remains stable.
   ============================================================ */

export async function deleteOwnMessage(
  messageId: string
): Promise<Message> {
  const account =
    requireAuthenticatedUser();


  const existing =
    await getMessageById(
      messageId
    );


  if (!existing) {
    throw createError(
      "MESSAGE_NOT_FOUND",
      "messages"
    );
  }


  if (
    existing.senderId !==
      account.id
  ) {
    throw createError(
      "PERMISSION_DENIED",
      "messages"
    );
  }


  if (
    existing.deletedAt
  ) {
    return existing;
  }


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_messages"
        )
        .update({
          deleted_at:
            new Date()
              .toISOString(),

          /*
           * Remove encrypted message payload from the
           * active row while keeping the tombstone.
           */
          ciphertext: {
            version: 1,
            type: "deleted"
          },

          metadata: {}
        })
        .eq(
          "id",
          messageId
        )
        .eq(
          "sender_id",
          account.id
        )
        .select(
          `
            id,
            client_message_id,
            conversation_id,
            sender_id,
            message_type,
            ciphertext,
            metadata,
            reply_to,
            edited_at,
            deleted_at,
            expires_at,
            created_at
          `
        )
        .single<MessageRow>();


    if (error) {
      throw error;
    }


    return mapMessage(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "messages",

        fallbackCode:
          "MESSAGE_DELETE_FAILED",

        context: {
          operation:
            "deleteOwnMessage",

          messageId
        }
      }
    );
  }
}


/* ============================================================
   REACTIONS
   One reaction per user per message.

   Sending another reaction updates that user's existing one.
   ============================================================ */

export async function setMessageReaction(
  messageId: string,
  rawReaction: string
): Promise<MessageReaction> {
  const account =
    requireAuthenticatedUser();


  const reaction =
    rawReaction.trim();


  if (
    !reaction ||
    reaction.length >
      MAX_REACTION_LENGTH
  ) {
    throw createError(
      "INVALID_INPUT",
      "messages",
      {
        message:
          "Invalid message reaction."
      }
    );
  }


  const message =
    await getMessageById(
      messageId
    );


  if (!message) {
    throw createError(
      "MESSAGE_NOT_FOUND",
      "messages"
    );
  }


  await requireConversationAccess(
    message.conversationId
  );


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_message_reactions"
        )
        .upsert(
          {
            message_id:
              messageId,

            user_id:
              account.id,

            reaction
          },
          {
            onConflict:
              "message_id,user_id"
          }
        )
        .select(
          `
            message_id,
            user_id,
            reaction,
            created_at,
            updated_at
          `
        )
        .single<ReactionRow>();


    if (error) {
      throw error;
    }


    return mapReaction(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "messages",

        context: {
          operation:
            "setMessageReaction",

          messageId
        }
      }
    );
  }
}


/* ============================================================
   REMOVE OWN REACTION
   ============================================================ */

export async function removeMessageReaction(
  messageId: string
): Promise<void> {
  const account =
    requireAuthenticatedUser();


  try {
    const {
      error
    } =
      await supabase
        .from(
          "bean_message_reactions"
        )
        .delete()
        .eq(
          "message_id",
          messageId
        )
        .eq(
          "user_id",
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
          "messages",

        context: {
          operation:
            "removeMessageReaction",

          messageId
        }
      }
    );
  }
}


/* ============================================================
   GET REACTIONS
   ============================================================ */

export async function getMessageReactions(
  messageId: string
): Promise<MessageReaction[]> {
  requireAuthenticatedUser();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_message_reactions"
        )
        .select(
          `
            message_id,
            user_id,
            reaction,
            created_at,
            updated_at
          `
        )
        .eq(
          "message_id",
          messageId
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        );


    if (error) {
      throw error;
    }


    return (
      data as
        ReactionRow[] | null
    )?.map(
      mapReaction
    ) ?? [];
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "messages",

        context: {
          operation:
            "getMessageReactions",

          messageId
        }
      }
    );
  }
}


/* ============================================================
   EXPIRY HELPERS
   ============================================================ */

export function isMessageExpired(
  message: Message,
  now = Date.now()
): boolean {
  if (!message.expiresAt) {
    return false;
  }


  const expiry =
    Date.parse(
      message.expiresAt
    );


  return (
    !Number.isNaN(expiry) &&
    expiry <= now
  );
}


/* ============================================================
   CLIENT MESSAGE ID
   ============================================================ */

function cryptoRandomUuid():
  string {
  if (
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }


  /*
   * Modern Bean-supported browsers should expose
   * crypto.randomUUID().
   *
   * Do not silently downgrade to Math.random().
   */
  throw createError(
    "NOT_SUPPORTED",
    "messages",
    {
      message:
        "Secure UUID generation is unavailable in this browser."
    }
  );
}
