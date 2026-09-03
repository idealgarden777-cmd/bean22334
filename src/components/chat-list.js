"use strict";

/*
=========================================================
BEAN — CHAT LIST
=========================================================

Owns:
- Mock conversation data
- Conversation list rendering
- Active conversation state
- Conversation selection event

Does not own:
- Message rendering
- Backend
- Realtime
- Search filtering
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
    id: "team",
    name: "Bean Team",
    initials: "BT",
    preview: "The new prototype is ready.",
    time: "Mon",
  },
];

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
      data-conversation-id="${conversation.id}"
      aria-pressed="${isActive}"
    >
      <span
        class="bean-avatar"
        aria-hidden="true"
      >
        ${conversation.initials}
      </span>

      <span class="bean-chat-item__content">

        <span class="bean-chat-item__top">

          <span class="bean-chat-item__name">
            ${conversation.name}
          </span>

          <span class="bean-chat-item__time">
            ${conversation.time}
          </span>

        </span>

        <span class="bean-chat-item__preview">
          ${conversation.preview}
        </span>

      </span>
    </button>
  `;
}

/*
=========================================================
RENDER
=========================================================
*/

export function renderChatList(activeConversationId = null) {
  const container = document.getElementById("conversationList");

  if (!container) {
    console.warn("Bean: conversation list container not found.");
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
SELECTION
=========================================================
*/

export function initChatList(onConversationSelect) {
  const container = document.getElementById("conversationList");

  if (!container) {
    console.warn("Bean: conversation list container not found.");
    return;
  }

  container.addEventListener("click", (event) => {
    const item = event.target.closest("[data-conversation-id]");

    if (!item) {
      return;
    }

    const conversationId = item.dataset.conversationId;

    const conversation = conversations.find(
      (item) => item.id === conversationId
    );

    if (!conversation) {
      return;
    }

    renderChatList(conversationId);

    if (typeof onConversationSelect === "function") {
      onConversationSelect(conversation);
    }
  });
}

/*
=========================================================
DATA ACCESS
=========================================================
*/

export function getConversations() {
  return conversations.map((conversation) => ({
    ...conversation,
  }));
}
