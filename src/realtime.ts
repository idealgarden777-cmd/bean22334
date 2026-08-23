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
   Realtime Module

   Responsibilities:
   - Own private conversation Realtime channels
   - Subscribe to trusted database broadcasts
   - Prevent duplicate channel subscriptions
   - Dispatch normalized conversation events
   - Recover subscriptions after reconnect
   - Cleanly unsubscribe channels

   Must NOT own:
   - Presence state
   - Typing indicators
   - Message database operations
   - Calls
   - Authentication lifecycle
   - Encryption
   - UI rendering

   Architecture:
   PostgreSQL
       ↓
   realtime.broadcast_changes(...)
       ↓
   private conversation channel
       ↓
   realtime.ts
       ↓
   feature/UI listeners
   ============================================================ */


/* ============================================================
   EVENTS

   These names must later match the database triggers
   defined in supabase/schema.sql.
   ============================================================ */

export type ConversationRealtimeEventName =
  | "message.insert"
  | "message.update"
  | "reaction.insert"
  | "reaction.update"
  | "reaction.delete"
  | "conversation.update"
  | "member.insert"
  | "member.update"
  | "member.delete";


const CONVERSATION_EVENTS:
  readonly ConversationRealtimeEventName[] = [
    "message.insert",
    "message.update",

    "reaction.insert",
    "reaction.update",
    "reaction.delete",

    "conversation.update",

    "member.insert",
    "member.update",
    "member.delete"
  ];


/* ============================================================
   EVENT PAYLOAD
   ============================================================ */

export interface ConversationRealtimeEvent {
  event:
    ConversationRealtimeEventName;

  conversationId:
    string;

  payload:
    Readonly<Record<string, unknown>>;

  receivedAt:
    number;
}


/* ============================================================
   LISTENER
   ============================================================ */

export type ConversationRealtimeListener =
  (
    event:
      ConversationRealtimeEvent
  ) => void;


/* ============================================================
   SUBSCRIPTION STATE
   ============================================================ */

export type RealtimeSubscriptionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";


export interface ConversationRealtimeSubscription {
  conversationId:
    string;

  state:
    RealtimeSubscriptionState;

  unsubscribe():
    Promise<void>;
}


/* ============================================================
   INTERNAL CHANNEL ENTRY
   ============================================================ */

interface ConversationChannelEntry {
  conversationId:
    string;

  channel:
    RealtimeChannel;

  state:
    RealtimeSubscriptionState;

  listeners:
    Set<ConversationRealtimeListener>;

  subscribePromise:
    Promise<void> | null;
}


/* ============================================================
   ACTIVE CHANNEL REGISTRY

   Exactly one Supabase channel per conversation.

   Multiple UI/features can listen to the same channel
   without creating extra WebSocket subscriptions.
   ============================================================ */

const conversationChannels =
  new Map<
    string,
    ConversationChannelEntry
  >();


/* ============================================================
   TOPIC

   schema.sql will broadcast conversation events to:

   conversation:<UUID>

   Example:
   conversation:91b39b8d-...
   ============================================================ */

function getConversationTopic(
  conversationId: string
): string {
  return `conversation:${conversationId}`;
}


/* ============================================================
   PAYLOAD NORMALIZATION
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


/* ============================================================
   DISPATCH
   ============================================================ */

function dispatchConversationEvent(
  entry:
    ConversationChannelEntry,

  event:
    ConversationRealtimeEventName,

  rawPayload:
    unknown
): void {
  const payload =
    asRecord(
      rawPayload
    );


  const normalized:
    ConversationRealtimeEvent = {
      event,

      conversationId:
        entry.conversationId,

      payload,

      receivedAt:
        Date.now()
    };


  for (
    const listener of
    entry.listeners
  ) {
    try {
      listener(
        normalized
      );
    } catch (error) {
      console.error(
        "[Bean:realtime] Conversation listener failed.",
        error
      );
    }
  }


  /*
   * Also expose one stable browser event for modules
   * that do not want a direct subscription callback.
   */
  window.dispatchEvent(
    new CustomEvent(
      "bean:conversation-event",
      {
        detail:
          normalized
      }
    )
  );
}


/* ============================================================
   CHANNEL CREATION

   IMPORTANT:
   private: true

   Anonymous/public conversation channels are forbidden.
   ============================================================ */

function createConversationChannel(
  conversationId: string
): ConversationChannelEntry {
  const topic =
    getConversationTopic(
      conversationId
    );


  const channel =
    supabase.channel(
      topic,
      {
        config: {
          private:
            true
        }
      }
    );


  const entry:
    ConversationChannelEntry = {
      conversationId,

      channel,

      state:
        "disconnected",

      listeners:
        new Set(),

      subscribePromise:
        null
    };


  for (
    const eventName of
    CONVERSATION_EVENTS
  ) {
    channel.on(
      "broadcast",
      {
        event:
          eventName
      },
      (
        eventPayload
      ) => {
        dispatchConversationEvent(
          entry,
          eventName,
          eventPayload.payload
        );
      }
    );
  }


  return entry;
}


/* ============================================================
   CHANNEL SUBSCRIBE
   ============================================================ */

function subscribeChannel(
  entry:
    ConversationChannelEntry
): Promise<void> {
  if (
    entry.state ===
      "connected"
  ) {
    return Promise.resolve();
  }


  if (
    entry.subscribePromise
  ) {
    return entry.subscribePromise;
  }


  entry.state =
    "connecting";


  entry.subscribePromise =
    new Promise<void>(
      (
        resolve,
        reject
      ) => {
        let settled =
          false;


        const finishSuccess =
          (): void => {
            if (settled) {
              return;
            }


            settled =
              true;

            entry.state =
              "connected";

            resolve();
          };


        const finishFailure =
          (
            reason: string
          ): void => {
            if (settled) {
              return;
            }


            settled =
              true;

            entry.state =
              "error";

            reject(
              createError(
                "REALTIME_SUBSCRIBE_FAILED",
                "realtime",
                {
                  message:
                    reason,

                  context: {
                    conversationId:
                      entry.conversationId
                  }
                }
              )
            );
          };


        entry.channel.subscribe(
          (
            status
          ) => {
            switch (status) {
              case "SUBSCRIBED":
                finishSuccess();
                break;


              case "CHANNEL_ERROR":
                finishFailure(
                  "Conversation Realtime channel failed."
                );
                break;


              case "TIMED_OUT":
                finishFailure(
                  "Conversation Realtime subscription timed out."
                );
                break;


              case "CLOSED":
                entry.state =
                  "disconnected";

                if (!settled) {
                  finishFailure(
                    "Conversation Realtime channel closed before subscription."
                  );
                }

                break;


              default:
                break;
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
   VERIFY CONVERSATION ACCESS

   RLS remains the final security boundary.

   This local membership check prevents unnecessary channel
   attempts and gives predictable application errors.
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
      "realtime",
      {
        context: {
          conversationId
        }
      }
    );
  }
}


/* ============================================================
   SUBSCRIBE TO CONVERSATION

   Multiple calls for the same conversation reuse the
   existing private Supabase channel.
   ============================================================ */

export async function subscribeToConversation(
  conversationId: string,

  listener:
    ConversationRealtimeListener
): Promise<ConversationRealtimeSubscription> {
  requireAuthenticatedUser();


  if (
    !config.realtimeEnabled
  ) {
    throw createError(
      "NOT_SUPPORTED",
      "realtime",
      {
        message:
          "Bean Realtime is disabled."
      }
    );
  }


  if (
    !conversationId.trim()
  ) {
    throw createError(
      "INVALID_INPUT",
      "realtime",
      {
        message:
          "Conversation ID is required."
      }
    );
  }


  await verifyConversationAccess(
    conversationId
  );


  /*
   * Realtime Authorization requires the current JWT
   * before joining private channels.
   */
  try {
    await refreshRealtimeAuth();
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "realtime",

        fallbackCode:
          "REALTIME_CONNECT_FAILED",

        context: {
          conversationId
        }
      }
    );
  }


  let entry =
    conversationChannels.get(
      conversationId
    );


  if (!entry) {
    entry =
      createConversationChannel(
        conversationId
      );


    conversationChannels.set(
      conversationId,
      entry
    );
  }


  entry.listeners.add(
    listener
  );


  try {
    await subscribeChannel(
      entry
    );
  } catch (error) {
    entry.listeners.delete(
      listener
    );


    /*
     * No consumer remains, so clean up the failed channel.
     */
    if (
      entry.listeners.size === 0
    ) {
      conversationChannels.delete(
        conversationId
      );


      await supabase.removeChannel(
        entry.channel
      );
    }


    throw normalizeError(
      error,
      {
        source:
          "realtime",

        fallbackCode:
          "REALTIME_SUBSCRIBE_FAILED",

        context: {
          conversationId
        }
      }
    );
  }


  let active =
    true;


  return {
    conversationId,

    get state() {
      return entry.state;
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


      /*
       * Keep the underlying channel alive while another
       * Bean feature is still listening.
       */
      if (
        entry.listeners.size > 0
      ) {
        return;
      }


      await removeConversationChannel(
        conversationId
      );
    }
  };
}


/* ============================================================
   REMOVE ONE CONVERSATION CHANNEL
   ============================================================ */

export async function removeConversationChannel(
  conversationId: string
): Promise<void> {
  const entry =
    conversationChannels.get(
      conversationId
    );


  if (!entry) {
    return;
  }


  conversationChannels.delete(
    conversationId
  );


  entry.listeners.clear();

  entry.state =
    "disconnected";


  try {
    await supabase.removeChannel(
      entry.channel
    );
  } catch (error) {
    console.warn(
      "[Bean:realtime] Channel cleanup failed.",
      normalizeError(
        error,
        {
          source:
            "realtime",

          context: {
            conversationId
          }
        }
      )
    );
  }
}


/* ============================================================
   REMOVE ALL CHANNELS

   Used during:
   - logout
   - app shutdown
   - account/session replacement
   ============================================================ */

export async function removeAllConversationChannels():
  Promise<void> {
  const entries =
    Array.from(
      conversationChannels.values()
    );


  conversationChannels.clear();


  await Promise.allSettled(
    entries.map(
      async (
        entry
      ) => {
        entry.listeners.clear();

        entry.state =
          "disconnected";


        await supabase.removeChannel(
          entry.channel
        );
      }
    )
  );
}


/* ============================================================
   ACTIVE CHANNEL INFORMATION
   ============================================================ */

export function isConversationSubscribed(
  conversationId: string
): boolean {
  return (
    conversationChannels.get(
      conversationId
    )?.state ===
      "connected"
  );
}


export function getActiveConversationIds():
  readonly string[] {
  return Array.from(
    conversationChannels.keys()
  );
}


/* ============================================================
   CONNECTION RECOVERY

   Called when:
   - browser comes back online
   - auth token refreshes
   - realtime connection needs rebuilding

   Listeners remain attached to their conversation entries.
   ============================================================ */

export async function reconnectRealtime():
  Promise<void> {
  requireAuthenticatedUser();


  if (
    !config.realtimeEnabled ||
    !navigator.onLine
  ) {
    return;
  }


  try {
    await refreshRealtimeAuth();
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "realtime",

        fallbackCode:
          "REALTIME_CONNECT_FAILED",

        context: {
          operation:
            "reconnectRealtime"
        }
      }
    );
  }


  const entries =
    Array.from(
      conversationChannels.values()
    );


  await Promise.allSettled(
    entries.map(
      async (
        entry
      ) => {
        /*
         * Fully remove the stale channel first.
         */
        try {
          await supabase.removeChannel(
            entry.channel
          );
        } catch {
          // Continue rebuilding.
        }


        const replacement =
          createConversationChannel(
            entry.conversationId
          );


        /*
         * Preserve existing application listeners.
         */
        replacement.listeners =
          entry.listeners;


        conversationChannels.set(
          entry.conversationId,
          replacement
        );


        try {
          await subscribeChannel(
            replacement
          );
        } catch (error) {
          replacement.state =
            "error";


          console.warn(
            "[Bean:realtime] Conversation reconnect failed.",
            normalizeError(
              error,
              {
                source:
                  "realtime",

                fallbackCode:
                  "REALTIME_CONNECT_FAILED",

                context: {
                  conversationId:
                    replacement.conversationId
                }
              }
            )
          );
        }
      }
    )
  );
}


/* ============================================================
   BROWSER NETWORK LIFECYCLE

   Offline:
   - state becomes disconnected
   - listeners remain registered

   Online:
   - channels reconnect using latest auth
   ============================================================ */

window.addEventListener(
  "offline",
  () => {
    for (
      const entry of
      conversationChannels.values()
    ) {
      entry.state =
        "disconnected";
    }
  }
);


window.addEventListener(
  "online",
  () => {
    if (
      conversationChannels.size ===
        0
    ) {
      return;
    }


    void reconnectRealtime()
      .catch(
        (
          error
        ) => {
          console.warn(
            "[Bean:realtime] Automatic reconnect failed.",
            error
          );
        }
      );
  }
);
