"use strict";

/*
=========================================================
BEAN — CHAT LIST
=========================================================

Owns:
- Prototype conversation data
- Conversation list rendering
- Active conversation state
- Conversation selection

Does not own:
- Chat messages
- Backend
- Realtime
- Authentication
=========================================================
*/

const conversations = [
  {
    id: "alex",
    name: "Alex Morgan",
    initials: "AM",
    preview: "Sounds good. See you tomorrow.",
    time: "9:42 AM",
  },
  {
    id: "sarah",
    name: "Sarah Khan",
    initials: "SK",
    preview: "I sent you the latest files.",
    time: "8:18 AM",
  },
  {
    id: "daniel",
    name: "Daniel Lee",
    initials: "DL",
    preview: "Let me check and get back to you.",
    time: "Yesterday",
  },
  {
    id: "emma",
    name: "Emma Wilson",
    initials: "EW",
    preview: "Perfect, thank you!",
    time: "Yesterday",
  },
  {
    id: "bean-team",
    name: "Bean Team",
    initials: "BT",
    preview: "The new prototype is ready.",
    time: "Mon",
  },
];

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

function getConversationById(id) {
  return conversations.find(
    (conversation) => conversation.id === id
  );
}

/*
=========================================================
CONVERSATION ITEM
=========================================================
*/

function createConversationItem(conversation, isActive) {
  const activeClass = isActive ? " is-active" : "";

  return `
    <button
      class="bean-chat-item${activeClass}"
      type="button"
      data-conversation-id="${escapeHTML(conversation.id)}"
      aria-pressed="${isActive}"
      role="listitem"
    >
      <span
        class="bean-avatar"
        aria-hidden="true"
      >
        ${escapeHTML(conversation.initials)}
      </span>

      <span class="bean-chat-item__content">

        <span class="bean-chat-item__top">

          <span class="bean-chat-item__name">
            ${escapeHTML(conversation.name)}
          </span>

          <span class="bean-chat-item__time">
            ${escapeHTML(conversation.time)}
          </span>

        </span>

        <span class="bean-chat-item__preview">
          ${escapeHTML(conversation.preview)}
        </span>

      </span>
    </button>
  `;
}

/*
=========================================================
RENDER CHAT LIST
=========================================================
*/

export function renderChatList(activeConversationId = null) {
  const container =
    document.getElementById("conversationList");

  if (!container) {
    console.warn(
      "Bean: #conversationList element not found."
    );
    return;
  }

  container.innerHTML = conversations
    .map((conversation) =>
      createConversationItem(
        conversation,
        conversation.id === activeConversationId
      )
    )
    .join("");
}

/*
=========================================================
INITIALIZE CHAT LIST
=========================================================
*/

export function initChatList(onConversationSelect) {
  const container =
    document.getElementById("conversationList");

  if (!container) {
    console.warn(
      "Bean: #conversationList element not found."
    );
    return;
  }

  container.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const item = target.closest(
      "[data-conversation-id]"
    );

    if (!item) {
      return;
    }

    const conversationId =
      item.dataset.conversationId;

    if (!conversationId) {
      return;
    }

    const conversation =
      getConversationById(conversationId);

    if (!conversation) {
      console.warn(
        `Bean: conversation "${conversationId}" not found.`
      );
      return;
    }

    renderChatList(conversation.id);

    if (typeof onConversationSelect === "function") {
      onConversationSelect({
        ...conversation,
      });
    }
  });
}

/*
=========================================================
PUBLIC DATA
=========================================================
*/

export function getConversations() {
  return conversations.map(
    (conversation) => ({ ...conversation })
  );
}
