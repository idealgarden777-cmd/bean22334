import {
  type RealtimeChannel
} from "@supabase/supabase-js";

import {
  config
} from "./core";

import {
  supabase,
  refreshRealtimeAuth
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
   Presence Module

   Responsibilities:
   - Track active users inside a conversation
   - Maintain conversation online/active state
   - Receive Presence sync/join/leave events
   - Send/receive ephemeral typing indicators
   - Support multiple browser tabs/devices safely
   - Clean up Presence channels deterministically

   Must NOT own:
   - Message delivery
   - Database message updates
   - Global notification logic
   - Calls
   - UI rendering
   - Long-term "last seen" persistence

   Architecture:

   Conversation
       │
       ├── Presence
       │     online / active state
       │
       └── Broadcast
             typing state
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const TYPING_EVENT =
  "typing";

const TYPING_TIMEOUT_MS =
  5_000;


/* ============================================================
   TYPES
   ============================================================ */

export type PresenceActivity =
  | "active"
  | "background";


export interface ConversationPresence {
  userId: string;

  activity: PresenceActivity;

  onlineAt: string;

  updatedAt: string;
}


export interface TypingState {
  conversationId: string;

  userId: string;

  isTyping: boolean;

  updatedAt: number;
}


export interface ConversationPresenceSnapshot {
  conversationId: string;

  users: ConversationPresence[];

  typingUsers: string[];
}


export type PresenceEventName =
  | "sync"
  | "join"
  | "leave"
  | "typing";


export interface PresenceEvent {
  event: PresenceEventName;

  conversationId: string;

  snapshot: ConversationPresenceSnapshot;

  receivedAt: number;
}


export type PresenceListener =
  (
    event: PresenceEvent
  ) => void;


export interface ConversationPresenceSubscription {
  conversationId: string;

  getSnapshot():
    ConversationPresenceSnapshot;

  setTyping(
    isTyping: boolean
  ): Promise<void>;

  updateActivity(
    activity: PresenceActivity
  ): Promise<void>;

  unsubscribe():
    Promise<void>;
}


/* ============================================================
   INTERNAL TYPES
   ============================================================ */

interface PresencePayload {
  userId: string;

  activity: PresenceActivity;

  onlineAt: string;

  updatedAt: string;
}


interface PresenceChannelEntry {
  conversationId: string;

  channel: RealtimeChannel;

  clientKey: string;

  listeners:
    Set<PresenceListener>;

  typingUsers:
    Map<string, number>;

  typingTimers:
    Map<string, number>;

  subscribed: boolean;

  subscribePromise:
    Promise<void> | null;

  tracked: boolean;

  onlineAt: string;
}


/* ============================================================
   REGISTRY

   One Presence channel per conversation.
   ============================================================ */

const presenceChannels =
  new Map<
    string,
    PresenceChannelEntry
  >();


/* ============================================================
   CLIENT IDENTITY

   Presence key must represent this specific browser client,
   not only the user UUID.

   Same user can have:
   - phone
   - desktop
   - second tab

   Payload still contains canonical internal user UUID.
   ============================================================ */

const presenceClientId =
  createPresenceClientId();


function createPresenceClientId():
  string {
  if (
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }


  throw createError(
    "NOT_SUPPORTED",
    "presence",
    {
      message:
        "Secure client identity generation is unavailable."
    }
  );
}


/* ============================================================
   TOPIC
   ============================================================ */

function getPresenceTopic(
  conversationId: string
): string {
  return `presence:conversation:${conversationId}`;
}


/* ============================================================
   PAYLOAD VALIDATION
   ============================================================ */

function isPresenceActivity(
  value: unknown
): value is PresenceActivity {
  return (
    value === "active" ||
    value === "background"
  );
}


function parsePresencePayload(
  value: unknown
): ConversationPresence | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }


  const candidate =
    value as Record<
      string,
      unknown
    >;


  if (
    typeof candidate.userId !==
      "string"
  ) {
    return null;
  }


  if (
    !isPresenceActivity(
      candidate.activity
    )
  ) {
    return null;
  }


  if (
    typeof candidate.onlineAt !==
      "string" ||
    typeof candidate.updatedAt !==
      "string"
  ) {
    return null;
  }


  return {
    userId:
      candidate.userId,

    activity:
      candidate.activity,

    onlineAt:
      candidate.onlineAt,

    updatedAt:
      candidate.updatedAt
  };
}


/* ============================================================
   PRESENCE STATE NORMALIZATION

   Supabase presenceState() is keyed by Presence key and
   each key may contain multiple metadata objects.

   Bean collapses multiple tabs/devices into one user.
   ============================================================ */

function readPresenceUsers(
  entry: PresenceChannelEntry
): ConversationPresence[] {
  const rawState =
    entry.channel.presenceState();

  const users =
    new Map<
      string,
      ConversationPresence
    >();


  for (
    const presences of
    Object.values(rawState)
  ) {
    if (
      !Array.isArray(presences)
    ) {
      continue;
    }


    for (
      const rawPresence of presences
    ) {
      const presence =
        parsePresencePayload(
          rawPresence
        );


      if (!presence) {
        continue;
      }


      const existing =
        users.get(
          presence.userId
        );


      if (!existing) {
        users.set(
          presence.userId,
          presence
        );

        continue;
      }


      /*
       * If one device/tab is active and another is
       * backgrounded, consider the user active.
       */
      const activity:
        PresenceActivity =
          existing.activity === "active" ||
          presence.activity === "active"
            ? "active"
            : "background";


      const newer =
        Date.parse(
          presence.updatedAt
        ) >
        Date.parse(
          existing.updatedAt
        )
          ? presence
          : existing;


      users.set(
        presence.userId,
        {
          ...newer,
          activity
        }
      );
    }
  }


  return Array.from(
    users.values()
  );
}


/* ============================================================
   TYPING STATE
   ============================================================ */

function getTypingUsers(
  entry: PresenceChannelEntry
): string[] {
  const now =
    Date.now();


  for (
    const [
      userId,
      updatedAt
    ] of entry.typingUsers
  ) {
    if (
      now - updatedAt >
        TYPING_TIMEOUT_MS
    ) {
      entry.typingUsers.delete(
        userId
      );
    }
  }


  return Array.from(
    entry.typingUsers.keys()
  );
}


/* ============================================================
   SNAPSHOT
   ============================================================ */

function createSnapshot(
  entry: PresenceChannelEntry
): ConversationPresenceSnapshot {
  return {
    conversationId:
      entry.conversationId,

    users:
      readPresenceUsers(
        entry
      ),

    typingUsers:
      getTypingUsers(
        entry
      )
  };
}


/* ============================================================
   EVENT DISPATCH
   ============================================================ */

function dispatchPresenceEvent(
  entry: PresenceChannelEntry,
  event: PresenceEventName
): void {
  const detail:
    PresenceEvent = {
      event,

      conversationId:
        entry.conversationId,

      snapshot:
        createSnapshot(
          entry
        ),

      receivedAt:
        Date.now()
    };


  for (
    const listener of
    entry.listeners
  ) {
    try {
      listener(
        detail
      );
    } catch (error) {
      console.error(
        "[Bean:presence] Listener failed.",
        error
      );
    }
  }


  window.dispatchEvent(
    new CustomEvent(
      "bean:presence-event",
      {
        detail
      }
    )
  );
}


/* ============================================================
   REMOTE TYPING
   ============================================================ */

function setRemoteTyping(
  entry: PresenceChannelEntry,
  userId: string,
  isTyping: boolean
): void {
  const existingTimer =
    entry.typingTimers.get(
      userId
    );


  if (
    existingTimer !== undefined
  ) {
    window.clearTimeout(
      existingTimer
    );

    entry.typingTimers.delete(
      userId
    );
  }


  if (!isTyping) {
    entry.typingUsers.delete(
      userId
    );

    dispatchPresenceEvent(
      entry,
      "typing"
    );

    return;
  }


  entry.typingUsers.set(
    userId,
    Date.now()
  );


  const timer =
    window.setTimeout(
      () => {
        entry.typingTimers.delete(
          userId
        );

        entry.typingUsers.delete(
          userId
        );

        dispatchPresenceEvent(
          entry,
          "typing"
        );
      },
      TYPING_TIMEOUT_MS
    );


  entry.typingTimers.set(
    userId,
    timer
  );


  dispatchPresenceEvent(
    entry,
    "typing"
  );
}


/* ============================================================
   CREATE CHANNEL

   Private channel only.
   ============================================================ */

function createPresenceChannel(
  conversationId: string,
  userId: string
): PresenceChannelEntry {
  const clientKey =
    `${userId}:${presenceClientId}`;


  const channel =
    supabase.channel(
      getPresenceTopic(
        conversationId
      ),
      {
        config: {
          private:
            true,

          presence: {
            key:
              clientKey
          }
        }
      }
    );


  const entry:
    PresenceChannelEntry = {
      conversationId,

      channel,

      clientKey,

      listeners:
        new Set(),

      typingUsers:
        new Map(),

      typingTimers:
        new Map(),

      subscribed:
        false,

      subscribePromise:
        null,

      tracked:
        false,

      onlineAt:
        new Date()
          .toISOString()
  };


  channel.on(
    "presence",
    {
      event:
        "sync"
    },
    () => {
      dispatchPresenceEvent(
        entry,
        "sync"
      );
    }
  );


  channel.on(
    "presence",
    {
      event:
        "join"
    },
    () => {
      dispatchPresenceEvent(
        entry,
        "join"
      );
    }
  );


  channel.on(
    "presence",
    {
      event:
        "leave"
    },
    () => {
      dispatchPresenceEvent(
        entry,
        "leave"
      );
    }
  );


  channel.on(
    "broadcast",
    {
      event:
        TYPING_EVENT
    },
    (
      message
    ) => {
      const payload =
        message.payload;


      if (
        typeof payload !==
          "object" ||
        payload === null
      ) {
        return;
      }


      const candidate =
        payload as Record<
          string,
          unknown
        >;


      if (
        typeof candidate.userId !==
          "string" ||
        typeof candidate.isTyping !==
          "boolean"
      ) {
        return;
      }


      /*
       * Ignore our own typing broadcast.
       */
      if (
        candidate.userId ===
          userId
      ) {
        return;
      }


      setRemoteTyping(
        entry,
        candidate.userId,
        candidate.isTyping
      );
    }
  );


  return entry;
}


/* ============================================================
   TRACK PRESENCE
   ============================================================ */

async function trackCurrentPresence(
  entry: PresenceChannelEntry,
  userId: string,
  activity: PresenceActivity
): Promise<void> {
  const now =
    new Date()
      .toISOString();


  const payload:
    PresencePayload = {
      userId,

      activity,

      onlineAt:
        entry.onlineAt,

      updatedAt:
        now
  };


  const status =
    await entry.channel.track(
      payload
    );


  if (
    status !== "ok"
  ) {
    throw createError(
      "REALTIME_CONNECT_FAILED",
      "presence",
      {
        message:
          "Presence tracking failed.",

        context: {
          conversationId:
            entry.conversationId,

          status
        }
      }
    );
  }


  entry.tracked =
    true;
}


/* ============================================================
   SUBSCRIBE CHANNEL
   ============================================================ */

function subscribePresenceChannel(
  entry: PresenceChannelEntry,
  userId: string
): Promise<void> {
  if (
    entry.subscribed
  ) {
    return Promise.resolve();
  }


  if (
    entry.subscribePromise
  ) {
    return entry.subscribePromise;
  }


  entry.subscribePromise =
    new Promise<void>(
      (
        resolve,
        reject
      ) => {
        let settled =
          false;


        const fail =
          (
            message: string
          ): void => {
            if (settled) {
              return;
            }


            settled =
              true;


            reject(
              createError(
                "REALTIME_SUBSCRIBE_FAILED",
                "presence",
                {
                  message,

                  context: {
                    conversationId:
                      entry.conversationId
                  }
                }
              )
            );
          };


        entry.channel.subscribe(
          async (
            status
          ) => {
            if (
              status ===
                "SUBSCRIBED"
            ) {
              if (settled) {
                return;
              }


              try {
                await trackCurrentPresence(
                  entry,
                  userId,
                  document.visibilityState ===
                    "visible"
                    ? "active"
                    : "background"
                );


                entry.subscribed =
                  true;

                settled =
                  true;

                resolve();
              } catch (error) {
                settled =
                  true;

                reject(
                  normalizeError(
                    error,
                    {
                      source:
                        "presence",

                      fallbackCode:
                        "REALTIME_CONNECT_FAILED"
                    }
                  )
                );
              }


              return;
            }


            if (
              status ===
                "CHANNEL_ERROR"
            ) {
              fail(
                "Presence channel failed."
              );

              return;
            }


            if (
              status ===
                "TIMED_OUT"
            ) {
              fail(
                "Presence channel timed out."
              );

              return;
            }


            if (
              status ===
                "CLOSED"
            ) {
              entry.subscribed =
                false;

              entry.tracked =
                false;


              if (!settled) {
                fail(
                  "Presence channel closed before subscription."
                );
              }
            }
          }
        );
      }
    );


  return entry.subscribePromise.finally(
    () => {
      entry.subscribePromise =
        null;
    }
  );
}


/* ============================================================
   ACCESS CHECK
   ============================================================ */

async function verifyConversationAccess(
  conversationId: string
): Promise<void> {
  const membership =
    await getOwnMembership(
      conversationId
    );


  if (!membership) {
    throw createError(
      "CONVERSATION_FORBIDDEN",
      "presence",
      {
        context: {
          conversationId
        }
      }
    );
  }
}


/* ============================================================
   START CONVERSATION PRESENCE
   ============================================================ */

export async function subscribeToConversationPresence(
  conversationId: string,
  listener: PresenceListener
): Promise<ConversationPresenceSubscription> {
  const account =
    requireAuthenticatedUser();


  if (
    !config.realtimeEnabled
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "presence",
      {
        message:
          "Bean Realtime is disabled."
      }
    );
  }


  const normalizedConversationId =
    conversationId.trim();


  if (
    !normalizedConversationId
  ) {
    throw createError(
      "INVALID_INPUT",
      "presence",
      {
        message:
          "Conversation ID is required."
      }
    );
  }


  await verifyConversationAccess(
    normalizedConversationId
  );


  try {
    await refreshRealtimeAuth();
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "presence",

        fallbackCode:
          "REALTIME_CONNECT_FAILED"
      }
    );
  }


  let entry =
    presenceChannels.get(
      normalizedConversationId
    );


  if (!entry) {
    entry =
      createPresenceChannel(
        normalizedConversationId,
        account.id
      );


    presenceChannels.set(
      normalizedConversationId,
      entry
    );
  }


  entry.listeners.add(
    listener
  );


  try {
    await subscribePresenceChannel(
      entry,
      account.id
    );
  } catch (error) {
    entry.listeners.delete(
      listener
    );


    if (
      entry.listeners.size === 0
    ) {
      await removePresenceChannel(
        normalizedConversationId
      );
    }


    throw normalizeError(
      error,
      {
        source:
          "presence",

        fallbackCode:
          "REALTIME_SUBSCRIBE_FAILED",

        context: {
          conversationId:
            normalizedConversationId
        }
      }
    );
  }


  let active =
    true;


  return {
    conversationId:
      normalizedConversationId,


    getSnapshot():
      ConversationPresenceSnapshot {
      return createSnapshot(
        entry
      );
    },


    async setTyping(
      isTyping: boolean
    ): Promise<void> {
      if (!active) {
        return;
      }


      await sendTypingState(
        entry,
        account.id,
        isTyping
      );
    },


    async updateActivity(
      activity: PresenceActivity
    ): Promise<void> {
      if (!active) {
        return;
      }


      await trackCurrentPresence(
        entry,
        account.id,
        activity
      );
    },


    async unsubscribe():
      Promise<void> {
      if (!active) {
        return;
      }


      active =
        false;


      entry.listeners.delete(
        listener
      );


      if (
        entry.listeners.size ===
          0
      ) {
        await removePresenceChannel(
          normalizedConversationId
        );
      }
    }
  };
}


/* ============================================================
   SEND TYPING STATE

   Uses Broadcast instead of Presence track().

   Typing contains:
   - internal UUID
   - boolean state
   - timestamp

   No message text is transmitted.
   ============================================================ */

async function sendTypingState(
  entry: PresenceChannelEntry,
  userId: string,
  isTyping: boolean
): Promise<void> {
  if (
    !entry.subscribed
  ) {
    return;
  }


  try {
    const status =
      await entry.channel.send({
        type:
          "broadcast",

        event:
          TYPING_EVENT,

        payload: {
          userId,

          isTyping,

          updatedAt:
            Date.now()
        }
      });


    if (
      status !== "ok"
    ) {
      throw createError(
        "REALTIME_CONNECT_FAILED",
        "presence",
        {
          message:
            "Typing broadcast failed.",

          context: {
            conversationId:
              entry.conversationId,

            status
          }
        }
      );
    }
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "presence",

        fallbackCode:
          "REALTIME_CONNECT_FAILED",

        context: {
          operation:
            "sendTypingState",

          conversationId:
            entry.conversationId
        }
      }
    );
  }
}


/* ============================================================
   SNAPSHOT ACCESS
   ============================================================ */

export function getConversationPresenceSnapshot(
  conversationId: string
): ConversationPresenceSnapshot | null {
  const entry =
    presenceChannels.get(
      conversationId
    );


  if (!entry) {
    return null;
  }


  return createSnapshot(
    entry
  );
}


/* ============================================================
   USER ONLINE CHECK
   ============================================================ */

export function isUserPresent(
  conversationId: string,
  userId: string
): boolean {
  const snapshot =
    getConversationPresenceSnapshot(
      conversationId
    );


  if (!snapshot) {
    return false;
  }


  return snapshot.users.some(
    (
      presence
    ) =>
      presence.userId ===
        userId
  );
}


/* ============================================================
   USER TYPING CHECK
   ============================================================ */

export function isUserTyping(
  conversationId: string,
  userId: string
): boolean {
  const snapshot =
    getConversationPresenceSnapshot(
      conversationId
    );


  if (!snapshot) {
    return false;
  }


  return snapshot.typingUsers.includes(
    userId
  );
}


/* ============================================================
   REMOVE CHANNEL
   ============================================================ */

export async function removePresenceChannel(
  conversationId: string
): Promise<void> {
  const entry =
    presenceChannels.get(
      conversationId
    );


  if (!entry) {
    return;
  }


  presenceChannels.delete(
    conversationId
  );


  for (
    const timer of
    entry.typingTimers.values()
  ) {
    window.clearTimeout(
      timer
    );
  }


  entry.typingTimers.clear();

  entry.typingUsers.clear();

  entry.listeners.clear();


  try {
    if (
      entry.tracked
    ) {
      await entry.channel.untrack();
    }
  } catch {
    /*
     * Channel may already be disconnected.
     */
  }


  try {
    await supabase.removeChannel(
      entry.channel
    );
  } catch (error) {
    console.warn(
      "[Bean:presence] Channel cleanup failed.",
      normalizeError(
        error,
        {
          source:
            "presence",

          context: {
            conversationId
          }
        }
      )
    );
  }
}


/* ============================================================
   REMOVE ALL PRESENCE
   ============================================================ */

export async function removeAllPresenceChannels():
  Promise<void> {
  const conversationIds =
    Array.from(
      presenceChannels.keys()
    );


  await Promise.allSettled(
    conversationIds.map(
      removePresenceChannel
    )
  );
}


/* ============================================================
   DOCUMENT VISIBILITY

   Presence changes are deliberately low-frequency:
   visible    -> active
   hidden     -> background
   ============================================================ */

document.addEventListener(
  "visibilitychange",
  () => {
    const account =
      requireAuthenticatedUserSafe();


    if (!account) {
      return;
    }


    const activity:
      PresenceActivity =
        document.visibilityState ===
          "visible"
          ? "active"
          : "background";


    for (
      const entry of
      presenceChannels.values()
    ) {
      if (
        !entry.subscribed
      ) {
        continue;
      }


      void trackCurrentPresence(
        entry,
        account.id,
        activity
      ).catch(
        (
          error
        ) => {
          console.warn(
            "[Bean:presence] Activity update failed.",
            error
          );
        }
      );
    }
  }
);


/* ============================================================
   SAFE AUTH LOOKUP FOR GLOBAL BROWSER EVENTS
   ============================================================ */

function requireAuthenticatedUserSafe():
  ReturnType<
    typeof requireAuthenticatedUser
  > | null {
  try {
    return requireAuthenticatedUser();
  } catch {
    return null;
  }
}


/* ============================================================
   NETWORK LIFECYCLE

   Supabase itself handles socket recovery.
   Presence state is re-tracked when needed.
   ============================================================ */

window.addEventListener(
  "online",
  () => {
    const account =
      requireAuthenticatedUserSafe();


    if (!account) {
      return;
    }


    void refreshRealtimeAuth()
      .then(
        async () => {
          const activity:
            PresenceActivity =
              document.visibilityState ===
                "visible"
                ? "active"
                : "background";


          const operations =
            Array.from(
              presenceChannels.values()
            ).map(
              async (
                entry
              ) => {
                if (
                  !entry.subscribed
                ) {
                  return;
                }


                await trackCurrentPresence(
                  entry,
                  account.id,
                  activity
                );
              }
            );


          await Promise.allSettled(
            operations
          );
        }
      )
      .catch(
        (
          error
        ) => {
          console.warn(
            "[Bean:presence] Online recovery failed.",
            error
          );
        }
      );
  }
);
