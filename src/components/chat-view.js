"use strict";

/*
=========================================================
BEAN — CHAT VIEW
=========================================================

Owns:
- Selected conversation view
- Chat header
- Mock messages
- Message composer
- Local prototype message sending

Does not own:
- Backend
- Realtime
- Persistence
- Attachments
- Calls
=========================================================
*/

const mockMessages = {
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

  team: [
    {
      id: "team-1",
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCurrentTime() {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function getMessages(conversationId) {
  if (!mockMessages[conversationId]) {
    mockMessages[conversationId] = [];
  }

  return mockMessages[conversationId];
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
    <div class="bean-message bean-message--${direction}">
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
CHAT HEADER
=========================================================
*/

function createChatHeader(conversation) {
  return `
    <header class="bean-chat-header">

      <div class="bean-chat-header__person">

        <div
          class="bean-avatar"
          aria-hidden="true"
        >
          ${escapeHTML(conversation.initials)}
        </div>

        <div class="bean-chat-header__info">

          <div class="bean-chat-header__name">
            ${escapeHTML(conversation.name)}
          </div>

          <div class="bean-chat-header__status">
            Online
          </div>

        </div>

      </div>

      <div class="bean-chat-header__actions">

        <button
          class="bean-nav-button"
          type="button"
          aria-label="Start voice call"
          title="Voice call"
          data-chat-action="voice"
        >
          <span aria-hidden="true">☎</span>
        </button>

        <button
          class="bean-nav-button"
          type="button"
          aria-label="Conversation information"
          title="Info"
          data-chat-action="info"
        >
          <span aria-hidden="true">ⓘ</span>
        </button>

      </div>

    </header>
  `;
}

/*
=========================================================
MESSAGES
=========================================================
*/

function createMessages(conversation) {
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
TEXTAREA
=========================================================
*/

function resizeComposer(textarea) {
  textarea.style.height = "auto";

  textarea.style.height =
    `${Math.min(textarea.scrollHeight, 140)}px`;
}

/*
=========================================================
SEND MESSAGE
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
      !event.shiftKey
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
  });
}

/*
=========================================================
RENDER
=========================================================
*/

export function renderChatView(conversation) {
  const chatView =
    document.getElementById("chatView");

  if (!chatView) {
    console.warn(
      "Bean: chat view container not found."
    );

    return;
  }

  if (!conversation?.id) {
    return;
  }

  chatView.innerHTML = `
    ${createChatHeader(conversation)}
    ${createMessages(conversation)}
    ${createComposer()}
  `;

  initComposer(conversation);
  scrollToLatestMessage();
}
