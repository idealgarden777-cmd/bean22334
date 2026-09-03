"use strict";

/*
=========================================================
BEAN — CHAT LIST
=========================================================

Owns:
- Conversation list UI
- Conversation selection
- Active conversation styling
- Search filtering

Uses:
- Frontend store

Does not own:
- Mock data
- Message data
- Chat rendering
- Backend
=========================================================
*/

import {
  getConversations,
  getActiveConversation,
  setActiveConversation,
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


function getInitials(conversation) {
  if (
    typeof conversation.initials === "string" &&
    conversation.initials.trim()
  ) {
    return conversation.initials.trim();
  }

  const name =
    typeof conversation.name === "string"
      ? conversation.name.trim()
      : "";

  if (!name) {
    return "?";
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}


/*
=========================================================
CONVERSATION ITEM
=========================================================
*/

function createConversationItem(
  conversation,
  activeConversationId
) {
  const isActive =
    conversation.id ===
    activeConversationId;

  const statusClass =
    conversation.status === "online"
      ? "bean-chat-item__status--online"
      : "";

  return `
    <button
      class="bean-chat-item${
        isActive
          ? " bean-chat-item--active"
          : ""
      }"
      type="button"
      data-conversation-id="${escapeHTML(
        conversation.id
      )}"
      aria-pressed="${
        isActive ? "true" : "false"
      }"
    >
      <div class="bean-chat-item__avatar">
        ${escapeHTML(
          getInitials(conversation)
        )}

        <span
          class="bean-chat-item__status ${statusClass}"
          aria-hidden="true"
        ></span>
      </div>

      <div class="bean-chat-item__body">

        <div class="bean-chat-item__top">
          <span class="bean-chat-item__name">
            ${escapeHTML(
              conversation.name
            )}
          </span>

          <span class="bean-chat-item__time">
            ${escapeHTML(
              conversation.time
            )}
          </span>
        </div>

        <div class="bean-chat-item__preview">
          ${escapeHTML(
            conversation.preview
          )}
        </div>

      </div>
    </button>
  `;
}


/*
=========================================================
RENDER CHAT LIST
=========================================================
*/

export function renderChatList(
  searchQuery = ""
) {
  const list =
    document.getElementById(
      "conversationList"
    );

  if (!list) {
    console.warn(
      "Bean: #conversationList element not found."
    );

    return;
  }

  const conversations =
    getConversations();

  const activeConversation =
    getActiveConversation();

  const activeConversationId =
    activeConversation?.id ?? null;

  const query =
    String(searchQuery)
      .trim()
      .toLowerCase();

  const filteredConversations =
    conversations.filter(
      (conversation) => {
        if (!query) {
          return true;
        }

        const searchableText = [
          conversation.name,
          conversation.beanId,
          conversation.preview,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          query
        );
      }
    );

  if (
    filteredConversations.length === 0
  ) {
    list.innerHTML = `
      <div class="bean-chat-list__empty">
        No conversations found.
      </div>
    `;

    return;
  }

  list.innerHTML =
    filteredConversations
      .map((conversation) =>
        createConversationItem(
          conversation,
          activeConversationId
        )
      )
      .join("");
}


/*
=========================================================
INITIALIZE CHAT LIST
=========================================================
*/

export function initChatList(
  onConversationSelect
) {
  const list =
    document.getElementById(
      "conversationList"
    );

  const searchInput =
    document.querySelector(
      "[data-chat-search]"
    );

  if (!list) {
    console.warn(
      "Bean: conversation list not found."
    );

    return;
  }

  list.addEventListener(
    "click",
    (event) => {
      const target =
        event.target.closest(
          "[data-conversation-id]"
        );

      if (!target) {
        return;
      }

      const conversationId =
        target.dataset
          .conversationId;

      if (!conversationId) {
        return;
      }

      const selected =
        setActiveConversation(
          conversationId
        );

      if (!selected) {
        return;
      }

      renderChatList(
        searchInput?.value ?? ""
      );

      const conversation =
        getActiveConversation();

      if (
        conversation &&
        typeof onConversationSelect ===
          "function"
      ) {
        onConversationSelect(
          conversation
        );
      }
    }
  );

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      () => {
        renderChatList(
          searchInput.value
        );
      }
    );
  }
}
