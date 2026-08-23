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
  getProfileById,
  getHandleByUserId,
  type BeanProfile
} from "./identity";


/* ============================================================
   BEAN — SIGNATURESI
   Conversations Module

   Responsibilities:
   - Create/reuse direct conversations
   - Read conversations for current user
   - Read conversation members
   - Resolve conversation participant identity
   - Track conversation-level read/mute state
   - Provide stable conversation domain objects

   Must NOT own:
   - Message send/edit/delete
   - Message encryption
   - Realtime subscriptions
   - Presence
   - Calls
   - Uploads
   - UI rendering
   ============================================================ */


/* ============================================================
   TYPES
   ============================================================ */

export type ConversationKind =
  | "direct"
  | "group"
  | "project";


export type ConversationRole =
  | "owner"
  | "admin"
  | "member";


export interface Conversation {
  id: string;

  kind: ConversationKind;

  createdBy: string | null;

  title: string | null;

  avatarPath: string | null;

  settings: Readonly<Record<string, unknown>>;

  createdAt: string;

  updatedAt: string;
}


export interface ConversationMember {
  conversationId: string;

  userId: string;

  role: ConversationRole;

  joinedAt: string;

  removedAt: string | null;

  lastReadAt: string | null;

  mutedUntil: string | null;
}


export interface ConversationParticipant {
  userId: string;

  username: string | null;

  beanId: string | null;

  profile: BeanProfile | null;
}


export interface ConversationSummary {
  conversation: Conversation;

  membership: ConversationMember;

  participants: ConversationParticipant[];
}


export interface UpdateConversationStateInput {
  lastReadAt?: string | null;

  mutedUntil?: string | null;
}


/* ============================================================
   DATABASE ROW TYPES
   ============================================================ */

interface ConversationRow {
  id: string;

  kind: ConversationKind;

  created_by: string | null;

  title: string | null;

  avatar_path: string | null;

  settings: unknown;

  created_at: string;

  updated_at: string;
}


interface MemberRow {
  conversation_id: string;

  user_id: string;

  role: ConversationRole;

  joined_at: string;

  removed_at: string | null;

  last_read_at: string | null;

  muted_until: string | null;
}


/* ============================================================
   HELPERS
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


function mapConversation(
  row: ConversationRow
): Conversation {
  return {
    id:
      row.id,

    kind:
      row.kind,

    createdBy:
      row.created_by,

    title:
      row.title,

    avatarPath:
      row.avatar_path,

    settings:
      asRecord(
        row.settings
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at
  };
}


function mapMember(
  row: MemberRow
): ConversationMember {
  return {
    conversationId:
      row.conversation_id,

    userId:
      row.user_id,

    role:
      row.role,

    joinedAt:
      row.joined_at,

    removedAt:
      row.removed_at,

    lastReadAt:
      row.last_read_at,

    mutedUntil:
      row.muted_until
  };
}


/* ============================================================
   GET CONVERSATION
   ============================================================ */

export async function getConversationById(
  conversationId: string
): Promise<Conversation | null> {
  requireAuthenticatedUser();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_conversations"
        )
        .select(
          `
            id,
            kind,
            created_by,
            title,
            avatar_path,
            settings,
            created_at,
            updated_at
          `
        )
        .eq(
          "id",
          conversationId
        )
        .maybeSingle<ConversationRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapConversation(data)
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "conversations",

        fallbackCode:
          "CONVERSATION_NOT_FOUND",

        context: {
          operation:
            "getConversationById",

          conversationId
        }
      }
    );
  }
}


/* ============================================================
   MEMBERS
   ============================================================ */

export async function getConversationMembers(
  conversationId: string
): Promise<ConversationMember[]> {
  requireAuthenticatedUser();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_conversation_members"
        )
        .select(
          `
            conversation_id,
            user_id,
            role,
            joined_at,
            removed_at,
            last_read_at,
            muted_until
          `
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .is(
          "removed_at",
          null
        )
        .order(
          "joined_at",
          {
            ascending: true
          }
        );


    if (error) {
      throw error;
    }


    return (
      data as MemberRow[] | null
    )?.map(
      mapMember
    ) ?? [];
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "conversations",

        fallbackCode:
          "CONVERSATION_FORBIDDEN",

        context: {
          operation:
            "getConversationMembers",

          conversationId
        }
      }
    );
  }
}


/* ============================================================
   CURRENT USER MEMBERSHIP
   ============================================================ */

export async function getOwnMembership(
  conversationId: string
): Promise<ConversationMember | null> {
  const account =
    requireAuthenticatedUser();


  try {
    const {
      data,
      error
    } =
      await supabase
        .from(
          "bean_conversation_members"
        )
        .select(
          `
            conversation_id,
            user_id,
            role,
            joined_at,
            removed_at,
            last_read_at,
            muted_until
          `
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          account.id
        )
        .is(
          "removed_at",
          null
        )
        .maybeSingle<MemberRow>();


    if (error) {
      throw error;
    }


    return data
      ? mapMember(data)
      : null;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "conversations",

        fallbackCode:
          "CONVERSATION_FORBIDDEN",

        context: {
          operation:
            "getOwnMembership",

          conversationId,

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   DIRECT CONVERSATION CREATION

   IMPORTANT:
   Creation happens through the trusted database RPC.

   Client does NOT:
   - calculate direct_key
   - insert arbitrary members
   - create duplicate direct chats

   Database RPC handles that atomically.
   ============================================================ */

export async function createDirectConversation(
  peerUserId: string
): Promise<Conversation> {
  const account =
    requireAuthenticatedUser();


  if (
    !peerUserId ||
    peerUserId === account.id
  ) {
    throw createError(
      "INVALID_INPUT",
      "conversations",
      {
        message:
          "A direct conversation requires another user."
      }
    );
  }


  try {
    const {
      data,
      error
    } =
      await supabase.rpc(
        "bean_create_direct_conversation",
        {
          p_peer_id:
            peerUserId
        }
      );


    if (error) {
      throw error;
    }


    if (
      typeof data !== "string" ||
      data.length === 0
    ) {
      throw createError(
        "CONVERSATION_NOT_FOUND",
        "conversations",
        {
          message:
            "Conversation creation returned no conversation ID."
        }
      );
    }


    const conversation =
      await getConversationById(
        data
      );


    if (!conversation) {
      throw createError(
        "CONVERSATION_NOT_FOUND",
        "conversations"
      );
    }


    return conversation;
  } catch (error) {
    const normalized =
      normalizeError(
        error,
        {
          source:
            "conversations",

          fallbackCode:
            "CONVERSATION_FORBIDDEN",

          context: {
            operation:
              "createDirectConversation",

            peerUserId
          }
        }
      );


    /*
     * Database RPC may intentionally reject a
     * conversation because either user blocked
     * the other.
     */
    if (
      normalized.message.includes(
        "conversation_not_allowed"
      )
    ) {
      throw createError(
        "USER_BLOCKED",
        "conversations",
        {
          cause:
            error,

          context: {
            peerUserId
          }
        }
      );
    }


    throw normalized;
  }
}


/* ============================================================
   LIST CURRENT USER CONVERSATIONS

   Current schema does not duplicate inbox rows.

   We first read current user's membership IDs, then fetch
   those conversations.

   Later messages.ts/realtime.ts will attach:
   - latest message
   - unread state
   - typing
   - delivery status

   without changing this conversation contract.
   ============================================================ */

export async function listConversations():
  Promise<ConversationSummary[]> {
  const account =
    requireAuthenticatedUser();


  try {
    const {
      data: membershipData,
      error: membershipError
    } =
      await supabase
        .from(
          "bean_conversation_members"
        )
        .select(
          `
            conversation_id,
            user_id,
            role,
            joined_at,
            removed_at,
            last_read_at,
            muted_until
          `
        )
        .eq(
          "user_id",
          account.id
        )
        .is(
          "removed_at",
          null
        )
        .order(
          "joined_at",
          {
            ascending: false
          }
        );


    if (membershipError) {
      throw membershipError;
    }


    const memberships =
      (
        membershipData as
          MemberRow[] | null
      )?.map(
        mapMember
      ) ?? [];


    if (
      memberships.length === 0
    ) {
      return [];
    }


    const conversationIds =
      memberships.map(
        (membership) =>
          membership.conversationId
      );


    const {
      data: conversationData,
      error: conversationError
    } =
      await supabase
        .from(
          "bean_conversations"
        )
        .select(
          `
            id,
            kind,
            created_by,
            title,
            avatar_path,
            settings,
            created_at,
            updated_at
          `
        )
        .in(
          "id",
          conversationIds
        )
        .order(
          "updated_at",
          {
            ascending: false
          }
        );


    if (conversationError) {
      throw conversationError;
    }


    const conversations =
      (
        conversationData as
          ConversationRow[] | null
      )?.map(
        mapConversation
      ) ?? [];


    const membershipMap =
      new Map<
        string,
        ConversationMember
      >();


    for (
      const membership of
      memberships
    ) {
      membershipMap.set(
        membership.conversationId,
        membership
      );
    }


    const summaries:
      ConversationSummary[] = [];


    for (
      const conversation of
      conversations
    ) {
      const membership =
        membershipMap.get(
          conversation.id
        );


      if (!membership) {
        continue;
      }


      const participants =
        await getConversationParticipants(
          conversation.id
        );


      summaries.push({
        conversation,
        membership,
        participants
      });
    }


    return summaries;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "conversations",

        context: {
          operation:
            "listConversations",

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   PARTICIPANT IDENTITIES
   ============================================================ */

export async function getConversationParticipants(
  conversationId: string
): Promise<ConversationParticipant[]> {
  const members =
    await getConversationMembers(
      conversationId
    );


  const participants =
    await Promise.all(
      members.map(
        async (
          member
        ): Promise<ConversationParticipant> => {
          const [
            profile,
            handle
          ] =
            await Promise.all([
              getProfileById(
                member.userId
              ),

              getHandleByUserId(
                member.userId
              )
            ]);


          return {
            userId:
              member.userId,

            username:
              handle?.username ??
              null,

            beanId:
              handle?.beanId ??
              null,

            profile
          };
        }
      )
    );


  return participants;
}


/* ============================================================
   DIRECT CHAT PEER
   ============================================================ */

export async function getDirectConversationPeer(
  conversationId: string
): Promise<ConversationParticipant | null> {
  const account =
    requireAuthenticatedUser();


  const conversation =
    await getConversationById(
      conversationId
    );


  if (!conversation) {
    return null;
  }


  if (
    conversation.kind !==
      "direct"
  ) {
    return null;
  }


  const participants =
    await getConversationParticipants(
      conversationId
    );


  return (
    participants.find(
      (participant) =>
        participant.userId !==
        account.id
    ) ??
    null
  );
}


/* ============================================================
   OPEN DIRECT CHAT BY UUID

   Public Bean ID lookup happens in identity.ts.

   Flow:

   bean@samuel
        ↓
   identity.ts
        ↓
   Samuel UUID
        ↓
   conversations.ts
        ↓
   conversation UUID
   ============================================================ */

export async function openDirectConversationWithUser(
  peerUserId: string
): Promise<ConversationSummary> {
  const conversation =
    await createDirectConversation(
      peerUserId
    );


  const membership =
    await getOwnMembership(
      conversation.id
    );


  if (!membership) {
    throw createError(
      "CONVERSATION_FORBIDDEN",
      "conversations",
      {
        context: {
          conversationId:
            conversation.id
        }
      }
    );
  }


  const participants =
    await getConversationParticipants(
      conversation.id
    );


  return {
    conversation,
    membership,
    participants
  };
}


/* ============================================================
   UPDATE OWN CONVERSATION STATE

   Used for:
   - read state
   - mute settings

   Does NOT alter other members.
   ============================================================ */

export async function updateOwnConversationState(
  conversationId: string,
  input: UpdateConversationStateInput
): Promise<ConversationMember> {
  const account =
    requireAuthenticatedUser();


  const payload:
    Record<string, string | null> = {};


  if (
    input.lastReadAt !==
      undefined
  ) {
    payload.last_read_at =
      input.lastReadAt;
  }


  if (
    input.mutedUntil !==
      undefined
  ) {
    payload.muted_until =
      input.mutedUntil;
  }


  if (
    Object.keys(
      payload
    ).length === 0
  ) {
    const existing =
      await getOwnMembership(
        conversationId
      );


    if (!existing) {
      throw createError(
        "CONVERSATION_FORBIDDEN",
        "conversations"
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
          "bean_conversation_members"
        )
        .update(
          payload
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .eq(
          "user_id",
          account.id
        )
        .is(
          "removed_at",
          null
        )
        .select(
          `
            conversation_id,
            user_id,
            role,
            joined_at,
            removed_at,
            last_read_at,
            muted_until
          `
        )
        .single<MemberRow>();


    if (error) {
      throw error;
    }


    return mapMember(
      data
    );
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "conversations",

        fallbackCode:
          "CONVERSATION_FORBIDDEN",

        context: {
          operation:
            "updateOwnConversationState",

          conversationId,

          userId:
            account.id
        }
      }
    );
  }
}


/* ============================================================
   MARK READ

   messages.ts can later call this after displaying all
   currently loaded messages.
   ============================================================ */

export async function markConversationRead(
  conversationId: string
): Promise<ConversationMember> {
  return updateOwnConversationState(
    conversationId,
    {
      lastReadAt:
        new Date().toISOString()
    }
  );
}


/* ============================================================
   MUTE
   ============================================================ */

export async function muteConversationUntil(
  conversationId: string,
  mutedUntil: Date | null
): Promise<ConversationMember> {
  return updateOwnConversationState(
    conversationId,
    {
      mutedUntil:
        mutedUntil
          ? mutedUntil.toISOString()
          : null
    }
  );
}
