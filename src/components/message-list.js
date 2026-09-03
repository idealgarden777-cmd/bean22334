"use strict";

/*
=========================================================
BEAN — MESSAGE LIST
=========================================================

Owns:
- Message list UI
- Message item rendering
- Empty message state
- Scroll to latest message

Uses:
- Frontend store

Does not own:
- Message state
- Message sending
- Composer
- Backend
- Realtime
=========================================================
*/

import {
  getMessages,
  addMessage as addStoreMessage,
} from "../core/store.js";


/*
=========================================================
HELPERS
=========================================================
*/

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/*
=========================================================
MESSAGE ITEM
=========================================================
*/

function createMessageItem(message) {
  const direction =
    message.direction === "incoming"
      ? "incoming"
      : "outgoing";

  return `
    <div
      class="bean-message bean-message--${direction}"
      data-message-id="${escapeHTML(message.id)}"
    >
      <div class="bean-message__bubble">

        <div class="bean-message__text">
          ${escapeHTML(message.text)}
        </div>

        <div class="bean-message__time">
          ${escapeHTML(message.time)}
        </div>

      </div>
    </div>
  `;
}


/*
=========================================================
EMPTY STATE
=========================================================
*/

function createEmptyState(conversation) {
  return `
    <div class="bean-empty">

      <div class="bean-empty__content">

        <h2 class="bean-empty__title">
          Start a conversation
        </h2>

        <p class="bean-empty__text">
          Send your first message to
          ${escapeHTML(conversation.name)}.
        </p>

      </div>

    </div>
  `;
}


/*
=========================================================
CREATE MESSAGE LIST
=========================================================
*/

export function createMessageList(conversation) {
  if (
    !conversation ||
    typeof conversation.id !== "string" ||
    !conversation.id.trim()
  ) {
    return "";
  }

  const messages =
    getMessages(conversation.id);

  const content =
    messages.length > 0
      ? messages
          .map(createMessageItem)
          .join("")
      : createEmptyState(conversation);

  return `
    <section
      class="bean-messages"
      id="messageList"
      aria-label="Messages"
    >
      <div class="bean-messages__inner">
        ${content}
      </div>
    </section>
  `;
}


/*
=========================================================
ADD MESSAGE
=========================================================
*/

export function addMessage(
  conversationId,
  message
) {
  return addStoreMessage(
    conversationId,
    message
  );
}


/*
=========================================================
SCROLL TO LATEST
=========================================================
*/

export function scrollToLatestMessage() {
  const messageList =
    document.getElementById(
      "messageList"
    );

  if (!messageList) {
    return;
  }

  messageList.scrollTop =
    messageList.scrollHeight;
}
