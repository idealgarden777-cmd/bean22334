"use strict";

import {
  getConversations,
  getActiveConversation,
  setActiveConversation,
} from "../core/store.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(conversation) {
  if (conversation.initials) {
    return conversation.initials;
  }

  return String(conversation.name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

function createChatItem(conversation, activeId) {
  const active = conversation.id === activeId;
  const online = conversation.status === "online";

  return `
    <button
      class="bean-chat-item${active ? " is-active" : ""}"
      type="button"
      data-conversation-id="${escapeHTML(conversation.id)}"
      aria-pressed="${active ? "true" : "false"}"
    >
      <div class="bean-chat-item__avatar">
        <span class="bean-avatar">
          ${escapeHTML(getInitials(conversation))}
        </span>

        ${
          online
            ? `
              <span
                class="bean-chat-item__status is-online"
                aria-hidden="true"
              ></span>
            `
            : ""
        }
      </div>

      <div class="bean-chat-item__content">
        <div class="bean-chat-item__top">
          <span class="bean-chat-item__name">
            ${escapeHTML(conversation.name)}
          </span>

          <span class="bean-chat-item__time">
            ${escapeHTML(conversation.time)}
          </span>
        </div>

        <div class="bean-chat-item__preview">
          ${escapeHTML(conversation.preview)}
        </div>
      </div>
    </button>
  `;
}

export function renderChatList(searchQuery = "") {
  const list = document.getElementById("conversationList");

  if (!list) {
    return;
  }

  const query = String(searchQuery)
    .trim()
    .toLowerCase();

  const activeId =
    getActiveConversation()?.id ?? null;

  const conversations = getConversations().filter(
    (conversation) => {
      if (!query) {
        return true;
      }

      const searchable = [
        conversation.name,
        conversation.beanId,
        conversation.preview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    }
  );

  if (conversations.length === 0) {
    list.innerHTML = `
      <div class="bean-chat-list__empty">
        No conversations found.
      </div>
    `;

    return;
  }

  list.innerHTML = conversations
    .map((conversation) =>
      createChatItem(conversation, activeId)
    )
    .join("");
}

export function initChatList(onConversationSelect) {
  const list = document.getElementById("conversationList");
  const searchInput = document.querySelector(
    "[data-chat-search]"
  );

  if (!list) {
    return;
  }

  list.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest(
      "[data-conversation-id]"
    );

    if (!button) {
      return;
    }

    const conversationId =
      button.dataset.conversationId;

    if (!conversationId) {
      return;
    }

    const selected =
      setActiveConversation(conversationId);

    if (!selected) {
      return;
    }

    renderChatList(searchInput?.value ?? "");

    const conversation =
      getActiveConversation();

    if (
      conversation &&
      typeof onConversationSelect === "function"
    ) {
      onConversationSelect(conversation);
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderChatList(searchInput.value);
    });
  }
}
