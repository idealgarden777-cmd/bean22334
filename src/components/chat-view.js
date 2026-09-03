"use strict";

/*
=========================================================
BEAN — CHAT VIEW
=========================================================

Owns:
- Selected conversation view
- Prototype messages
- Message composer
- Local message sending

Uses:
- chat-header.js

Does not own:
- Backend
- Realtime
- Authentication
- Persistence
=========================================================
*/

import {
  createChatHeader,
  initChatHeader,
} from "./chat-header.js";

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

function getMessages(conversationId) {
  if (!messagesByConversation[conversationId]) {
    messagesByConversation[conversationId] = [];
  }

  return messagesByConversation[conversationId];
}

function getCurrentTime() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

/*
=========================================================
MESSAGE
=========================================================
*/

function createMessage(message) {
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
MESSAGE LIST
=========================================================
*/

function createMessageList(conversation) {
  const messages = getMessages(conversation.id);

  const content = messages.length
    ? messages.map(createMessage).join("")
    : `
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
COMPOSER
=========================================================
*/

function createComposer() {
  return `
    <div class="bean-composer-area">

      <form
        class="bean-composer"
        id="messageComposer"
      >

        <textarea
          class="bean-composer__input"
          id="messageInput"
          rows="1"
          maxlength="5000"
          placeholder="Message"
          aria-label="Message"
        ></textarea>

        <button
          class="bean-composer__send"
          type="submit"
          aria-label="Send message"
          title="Send"
        >
          <span aria-hidden="true">↑</span>
        </button>

      </form>

    </div>
  `;
}

/*
=========================================================
SCROLL
=========================================================
*/

function scrollToLatestMessage() {
  const messageList =
    document.getElementById("messageList");

  if (!messageList) {
    return;
  }

  messageList.scrollTop =
    messageList.scrollHeight;
}

/*
=========================================================
COMPOSER RESIZE
=========================================================
*/

function resizeComposer(input) {
  input.style.height = "auto";

  const height = Math.min(
    input.scrollHeight,
    140
  );

  input.style.height = `${height}px`;
}

/*
=========================================================
COMPOSER EVENTS
=========================================================
*/

function initComposer(conversation) {
  const form =
    document.getElementById("messageComposer");

  const input =
    document.getElementById("messageInput");

  if (!form || !input) {
    return;
  }

  input.addEventListener("input", () => {
    resizeComposer(input);
  });

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = input.value.trim();

    if (!text) {
      return;
    }

    const messages =
      getMessages(conversation.id);

    messages.push({
      id: `${conversation.id}-${Date.now()}`,
      direction: "outgoing",
      text,
      time: getCurrentTime(),
    });

    renderChatView(conversation);

    const newInput =
      document.getElementById("messageInput");

    if (newInput) {
      newInput.focus();
    }
  });
}

/*
=========================================================
HEADER ACTIONS
=========================================================
*/

function handleHeaderAction(action, conversation) {
  switch (action) {
    case "profile":
    case "info":
      console.log(
        `Bean: open details for ${conversation.name}`
      );
      break;

    case "voice":
      console.log(
        `Bean: voice call with ${conversation.name}`
      );
      break;

    case "video":
      console.log(
        `Bean: video call with ${conversation.name}`
      );
      break;

    case "search":
      console.log(
        `Bean: search conversation with ${conversation.name}`
      );
      break;

    default:
      console.warn(
        `Bean: unknown chat header action "${action}".`
      );
  }
}

/*
=========================================================
RENDER CHAT VIEW
=========================================================
*/

export function renderChatView(conversation) {
  const chatView =
    document.getElementById("chatView");

  if (!chatView) {
    console.warn(
      "Bean: #chatView element not found."
    );
    return;
  }

  if (
    !conversation ||
    typeof conversation.id !== "string"
  ) {
    console.warn(
      "Bean: invalid conversation."
    );
    return;
  }

  chatView.innerHTML = `
    ${createChatHeader(conversation)}
    ${createMessageList(conversation)}
    ${createComposer()}
  `;

  initChatHeader((action) => {
    handleHeaderAction(
      action,
      conversation
    );
  });

  initComposer(conversation);

  scrollToLatestMessage();
}
