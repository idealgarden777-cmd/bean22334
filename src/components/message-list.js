"use strict";

/*
=========================================================
BEAN — MESSAGE LIST
=========================================================

Owns:
- Prototype message data
- Message rendering
- Message creation
- Message list scrolling

Does not own:
- Chat header
- Composer UI
- Backend
- Realtime
- Persistence
=========================================================
*/

/*
=========================================================
PROTOTYPE MESSAGE DATA
=========================================================
*/

const messagesByConversation = {
  alex: [
    {
      id: "alex-1",
      direction: "incoming",
      text: "Hey! How is the Bean prototype going?",
      time: "9:38 AM",
    },
    {
      id: "alex-2",
      direction: "outgoing",
      text: "Going well. I am working on the chat interface now.",
      time: "9:40 AM",
    },
    {
      id: "alex-3",
      direction: "incoming",
      text: "Sounds good. See you tomorrow.",
      time: "9:42 AM",
    },
  ],

  sarah: [
    {
      id: "sarah-1",
      direction: "incoming",
      text: "I sent you the latest files.",
      time: "8:18 AM",
    },
  ],

  daniel: [
    {
      id: "daniel-1",
      direction: "outgoing",
      text: "Can you review the latest version?",
      time: "Yesterday",
    },
    {
      id: "daniel-2",
      direction: "incoming",
      text: "Let me check and get back to you.",
      time: "Yesterday",
    },
  ],

  emma: [
    {
      id: "emma-1",
      direction: "outgoing",
      text: "Everything has been updated.",
      time: "Yesterday",
    },
    {
      id: "emma-2",
      direction: "incoming",
      text: "Perfect, thank you!",
      time: "Yesterday",
    },
  ],

  "bean-team": [
    {
      id: "bean-team-1",
      direction: "incoming",
      text: "The new prototype is ready.",
      time: "Mon",
    },
  ],
};

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

function getConversationMessages(conversationId) {
  if (!messagesByConversation[conversationId]) {
    messagesByConversation[conversationId] = [];
  }

  return messagesByConversation[conversationId];
}

/*
=========================================================
MESSAGE ITEM
=========================================================
*/

function createMessageItem(message) {
  const direction =
    message.direction === "outgoing"
      ? "outgoing"
      : "incoming";

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

function createEmptyMessages(conversation) {
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
    typeof conversation.id !== "string"
  ) {
    return "";
  }

  const messages =
    getConversationMessages(conversation.id);

  const content = messages.length
    ? messages.map(createMessageItem).join("")
    : createEmptyMessages(conversation);

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
  {
    id,
    direction = "outgoing",
    text,
    time,
  }
) {
  if (
    typeof conversationId !== "string" ||
    !conversationId
  ) {
    return false;
  }

  const cleanText =
    typeof text === "string"
      ? text.trim()
      : "";

  if (!cleanText) {
    return false;
  }

  const messages =
    getConversationMessages(conversationId);

  messages.push({
    id:
      id ??
      `${conversationId}-${Date.now()}`,

    direction:
      direction === "incoming"
        ? "incoming"
        : "outgoing",

    text: cleanText,

    time:
      typeof time === "string"
        ? time
        : "",
  });

  return true;
}

/*
=========================================================
GET MESSAGES
=========================================================
*/

export function getMessages(conversationId) {
  return getConversationMessages(
    conversationId
  ).map((message) => ({
    ...message,
  }));
}

/*
=========================================================
SCROLL TO LATEST
=========================================================
*/

export function scrollToLatestMessage() {
  const messageList =
    document.getElementById("messageList");

  if (!messageList) {
    return;
  }

  messageList.scrollTop =
    messageList.scrollHeight;
}
