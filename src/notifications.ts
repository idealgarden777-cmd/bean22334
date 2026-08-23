import {
  requireAuthenticatedUser
} from "./auth";

import {
  createError,
  normalizeError
} from "./errors";


/* ============================================================
   BEAN — SIGNATURESI
   Notifications Module

   Responsibilities:
   - Manage browser notification permission
   - Show safe local/browser notifications
   - Suppress notifications for active conversations
   - Emit in-app notification events
   - Track app visibility
   - Provide future Web Push registration contract

   Must NOT own:
   - Message database queries
   - Realtime subscriptions
   - Push backend implementation
   - VAPID private keys
   - Service-worker push server logic
   - Notification UI rendering
   - Notification persistence

   SECURITY / PRIVACY:
   - Do not expose plaintext message content by default
   - Do not include secrets or tokens
   - Avoid notification previews when privacy mode is enabled
   ============================================================ */


/* ============================================================
   TYPES
   ============================================================ */

export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";


export type BeanNotificationKind =
  | "message"
  | "reaction"
  | "call"
  | "mention"
  | "work"
  | "system";


export interface BeanNotification {
  id: string;

  kind: BeanNotificationKind;

  title: string;

  body?: string;

  conversationId?: string;

  senderId?: string;

  icon?: string;

  tag?: string;

  data?: Readonly<
    Record<string, unknown>
  >;
}


export interface NotificationPreferences {
  enabled: boolean;

  showMessagePreview: boolean;

  playSound: boolean;
}


export interface PushRegistrationProvider {
  register():
    Promise<void>;

  unregister():
    Promise<void>;

  isRegistered():
    boolean;
}


/* ============================================================
   STATE
   ============================================================ */

const preferences:
  NotificationPreferences = {
    enabled:
      true,

    showMessagePreview:
      false,

    playSound:
      true
  };


let activeConversationId:
  string | null = null;


let pushProvider:
  PushRegistrationProvider | null = null;


/* ============================================================
   PERMISSION
   ============================================================ */

export function getNotificationPermission():
  NotificationPermissionState {
  if (
    !("Notification" in window)
  ) {
    return "unsupported";
  }


  return Notification.permission;
}


export async function requestNotificationPermission():
  Promise<NotificationPermissionState> {
  requireAuthenticatedUser();


  if (
    !("Notification" in window)
  ) {
    return "unsupported";
  }


  try {
    const permission =
      await Notification.requestPermission();


    return permission;
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "notifications",

        fallbackCode:
          "PERMISSION_DENIED",

        context: {
          operation:
            "requestNotificationPermission"
        }
      }
    );
  }
}


/* ============================================================
   PREFERENCES
   ============================================================ */

export function getNotificationPreferences():
  Readonly<NotificationPreferences> {
  return preferences;
}


export function updateNotificationPreferences(
  input:
    Partial<NotificationPreferences>
): void {
  if (
    input.enabled !==
      undefined
  ) {
    preferences.enabled =
      input.enabled;
  }


  if (
    input.showMessagePreview !==
      undefined
  ) {
    preferences.showMessagePreview =
      input.showMessagePreview;
  }


  if (
    input.playSound !==
      undefined
  ) {
    preferences.playSound =
      input.playSound;
  }


  window.dispatchEvent(
    new CustomEvent(
      "bean:notification-preferences",
      {
        detail: {
          ...preferences
        }
      }
    )
  );
}


/* ============================================================
   ACTIVE CONVERSATION

   ui.ts will update this when the user opens/closes a chat.

   If user is already actively viewing a conversation,
   Bean should normally avoid showing a system notification.
   ============================================================ */

export function setActiveNotificationConversation(
  conversationId:
    string | null
): void {
  activeConversationId =
    conversationId;
}


export function getActiveNotificationConversation():
  string | null {
  return activeConversationId;
}


/* ============================================================
   SAFE BODY
   ============================================================ */

function getSafeNotificationBody(
  notification:
    BeanNotification
): string | undefined {
  if (
    !preferences.showMessagePreview
  ) {
    switch (
      notification.kind
    ) {
      case "message":
        return "New message";

      case "reaction":
        return "New reaction";

      case "call":
        return "Incoming call";

      case "mention":
        return "You were mentioned";

      case "work":
        return "New work update";

      case "system":
      default:
        return notification.body;
    }
  }


  return notification.body;
}


/* ============================================================
   SUPPRESSION RULES
   ============================================================ */

function shouldSuppressNotification(
  notification:
    BeanNotification
): boolean {
  if (
    !preferences.enabled
  ) {
    return true;
  }


  /*
   * If the current tab is visible and the exact
   * conversation is open, don't show a browser-level alert.
   */
  if (
    document.visibilityState ===
      "visible" &&
    notification.conversationId &&
    notification.conversationId ===
      activeConversationId
  ) {
    return true;
  }


  return false;
}


/* ============================================================
   IN-APP EVENT

   UI can listen to:
   bean:notification

   even when browser notifications are suppressed.
   ============================================================ */

function emitInAppNotification(
  notification:
    BeanNotification
): void {
  window.dispatchEvent(
    new CustomEvent(
      "bean:notification",
      {
        detail:
          notification
      }
    )
  );
}


/* ============================================================
   SERVICE WORKER REGISTRATION
   ============================================================ */

async function getServiceWorkerRegistration():
  Promise<ServiceWorkerRegistration | null> {
  if (
    !("serviceWorker" in navigator)
  ) {
    return null;
  }


  try {
    const registration =
      await navigator.serviceWorker.ready;


    return registration;
  } catch {
    return null;
  }
}


/* ============================================================
   SHOW NOTIFICATION
   ============================================================ */

export async function notify(
  notification:
    BeanNotification
): Promise<void> {
  requireAuthenticatedUser();


  /*
   * In-app notification event always fires first.
   */
  emitInAppNotification(
    notification
  );


  if (
    shouldSuppressNotification(
      notification
    )
  ) {
    return;
  }


  const permission =
    getNotificationPermission();


  if (
    permission !==
      "granted"
  ) {
    return;
  }


  const body =
    getSafeNotificationBody(
      notification
    );


  const registration =
    await getServiceWorkerRegistration();


  const options:
    NotificationOptions = {
      body,

      icon:
        notification.icon ??
        "/icons/icon-192.png",

      badge:
        "/icons/icon-192.png",

      tag:
        notification.tag ??
        notification.id,

      data: {
        notificationId:
          notification.id,

        kind:
          notification.kind,

        conversationId:
          notification.conversationId ??
          null,

        senderId:
          notification.senderId ??
          null,

        ...(notification.data ?? {})
      }
    };


  try {
    /*
     * Prefer ServiceWorker notifications because they
     * integrate correctly with installed PWA behavior.
     */
    if (registration) {
      await registration
        .showNotification(
          notification.title,
          options
        );


      return;
    }


    /*
     * Fallback for supported desktop browsers.
     */
    new Notification(
      notification.title,
      options
    );
  } catch (error) {
    console.warn(
      "[Bean:notifications] Notification display failed.",
      normalizeError(
        error,
        {
          source:
            "notifications",

          context: {
            operation:
              "notify",

            notificationId:
              notification.id
          }
        }
      )
    );
  }
}


/* ============================================================
   MESSAGE NOTIFICATION HELPER

   Note:
   plaintext preview is optional and controlled by preference.

   This helper does NOT fetch or decrypt messages.
   ============================================================ */

export async function notifyNewMessage(
  input: {
    messageId: string;

    conversationId: string;

    senderId: string;

    senderName: string;

    preview?: string;
  }
): Promise<void> {
  await notify({
    id:
      input.messageId,

    kind:
      "message",

    title:
      input.senderName,

    body:
      input.preview,

    conversationId:
      input.conversationId,

    senderId:
      input.senderId,

    tag:
      `conversation:${input.conversationId}`
  });
}


/* ============================================================
   REACTION NOTIFICATION
   ============================================================ */

export async function notifyReaction(
  input: {
    id: string;

    conversationId: string;

    senderId: string;

    senderName: string;

    reaction?: string;
  }
): Promise<void> {
  await notify({
    id:
      input.id,

    kind:
      "reaction",

    title:
      input.senderName,

    body:
      input.reaction
        ? `Reacted ${input.reaction}`
        : "Reacted to your message",

    conversationId:
      input.conversationId,

    senderId:
      input.senderId,

    tag:
      `reaction:${input.id}`
  });
}


/* ============================================================
   CALL NOTIFICATION
   ============================================================ */

export async function notifyIncomingCall(
  input: {
    callId: string;

    conversationId: string;

    callerId: string;

    callerName: string;

    video: boolean;
  }
): Promise<void> {
  await notify({
    id:
      input.callId,

    kind:
      "call",

    title:
      input.callerName,

    body:
      input.video
        ? "Incoming video call"
        : "Incoming voice call",

    conversationId:
      input.conversationId,

    senderId:
      input.callerId,

    tag:
      `call:${input.callId}`,

    data: {
      callId:
        input.callId,

      video:
        input.video
    }
  });
}


/* ============================================================
   PUSH PROVIDER CONTRACT

   Future server-backed Web Push implementation registers here.

   notifications.ts does not need to know:
   - VAPID implementation
   - backend endpoint
   - token table
   - push provider
   ============================================================ */

export function registerPushProvider(
  provider:
    PushRegistrationProvider
): void {
  pushProvider =
    provider;
}


export function unregisterPushProvider():
  void {
  pushProvider =
    null;
}


/* ============================================================
   ENABLE PUSH
   ============================================================ */

export async function enablePushNotifications():
  Promise<void> {
  requireAuthenticatedUser();


  const permission =
    await requestNotificationPermission();


  if (
    permission !==
      "granted"
  ) {
    throw createError(
      "PERMISSION_DENIED",
      "notifications",
      {
        message:
          "Notification permission was not granted."
      }
    );
  }


  if (!pushProvider) {
    throw createError(
      "NOT_SUPPORTED",
      "notifications",
      {
        message:
          "Push notification provider is not configured."
      }
    );
  }


  try {
    await pushProvider.register();
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "notifications",

        fallbackCode:
          "SERVICE_UNAVAILABLE",

        context: {
          operation:
            "enablePushNotifications"
        }
      }
    );
  }
}


/* ============================================================
   DISABLE PUSH
   ============================================================ */

export async function disablePushNotifications():
  Promise<void> {
  if (!pushProvider) {
    return;
  }


  try {
    await pushProvider.unregister();
  } catch (error) {
    throw normalizeError(
      error,
      {
        source:
          "notifications",

        context: {
          operation:
            "disablePushNotifications"
        }
      }
    );
  }
}


/* ============================================================
   PUSH STATUS
   ============================================================ */

export function isPushRegistered():
  boolean {
  return (
    pushProvider?.isRegistered() ??
    false
  );
}


/* ============================================================
   CLOSE NOTIFICATIONS BY TAG

   Useful when user opens a conversation.
   ============================================================ */

export async function closeNotificationsByTag(
  tag: string
): Promise<void> {
  const registration =
    await getServiceWorkerRegistration();


  if (!registration) {
    return;
  }


  try {
    const notifications =
      await registration
        .getNotifications({
          tag
        });


    for (
      const notification of
      notifications
    ) {
      notification.close();
    }
  } catch (error) {
    console.warn(
      "[Bean:notifications] Notification cleanup failed.",
      error
    );
  }
}


/* ============================================================
   CONVERSATION OPENED

   UI can call this when entering a chat.
   ============================================================ */

export async function onConversationOpened(
  conversationId: string
): Promise<void> {
  setActiveNotificationConversation(
    conversationId
  );


  await closeNotificationsByTag(
    `conversation:${conversationId}`
  );
}


/* ============================================================
   CONVERSATION CLOSED
   ============================================================ */

export function onConversationClosed(
  conversationId: string
): void {
  if (
    activeConversationId ===
      conversationId
  ) {
    activeConversationId =
      null;
  }
}
