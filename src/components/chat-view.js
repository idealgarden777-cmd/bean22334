"use strict";

/*
=========================================================
BEAN — CHAT VIEW
=========================================================

Owns:
- Selected conversation layout
- Composer behavior
- Header action coordination
- Local prototype message sending

Uses:
- chat-header.js
- message-list.js

Does not own:
- Message data
- Message rendering
- Backend
- Realtime
- Persistence
=========================================================
*/

import {
  createChatHeader,
  initChatHeader,
} from "./chat-header.js";

import {
  createMessageList,
  addMessage,
  scrollToLatestMessage,
} from "./message-list.js";

/*
=========================================================
TIME
=========================================================
*/

function getCurrentTime() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
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
          autocomplete="off"
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

    const added = addMessage(
      conversation.id,
      {
        direction: "outgoing",
        text,
        time: getCurrentTime(),
      }
    );

    if (!added) {
      return;
    }

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

function handleHeaderAction(
  action,
  conversation
) {
  switch (action) {
    case "profile":
    case "info":
      console.log(
        `Bean: open details for ${conversation.name}`
      );
      break;

    case "voice":
      console.log(
        `Bean: start voice call with ${conversation.name}`
      );
      break;

    case "video":
      console.log(
        `Bean: start video call with ${conversation.name}`
      );
      break;

    case "search":
      console.log(
        `Bean: search conversation with ${conversation.name}`
      );
      break;

    default:
      console.warn(
        `Bean: unknown header action "${action}".`
      );
  }
}

/*
=========================================================
VALIDATION
=========================================================
*/

function isValidConversation(conversation) {
  return Boolean(
    conversation &&
    typeof conversation.id === "string" &&
    conversation.id.trim()
  );
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

  if (!isValidConversation(conversation)) {
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
