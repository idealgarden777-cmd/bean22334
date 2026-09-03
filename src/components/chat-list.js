"use strict";

/* =========================================================
   BEAN — CHAT LIST
   Conversation list rendering + selection + search
   ========================================================= */

import {
  getConversations,
  getActiveConversationId,
  setActiveConversation,
} from "../core/store.js";


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "B";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}


/* =========================================================
   CHAT ITEM
   ========================================================= */

function createChatItem(
  conversation,
  activeChatId
) {
  const active =
    conversation.id === activeChatId;

  const initials =
    conversation.initials ||
    getInitials(conversation.name);

  const unread =
    Number(conversation.unread ?? 0);

  const online =
    conversation.online === true;

  return `
    <button
      class="bean-chat-item${active ? " is-active" : ""}"
      type="button"
      data-chat-id="${escapeHTML(conversation.id)}"
      aria-label="Open chat with ${escapeHTML(conversation.name)}"
      aria-current="${active ? "true" : "false"}"
    >

      <div class="bean-chat-item__avatar">
        ${
          conversation.avatar
            ? `
              <img
                src="${escapeHTML(conversation.avatar)}"
                alt=""
                loading="lazy"
              >
            `
            : escapeHTML(initials)
        }

        <span
          class="bean-presence${online ? " is-online" : ""}"
          aria-hidden="true"
        ></span>
      </div>


      <div class="bean-chat-item__body">

        <div class="bean-chat-item__top">
          <strong>
            ${escapeHTML(conversation.name)}
          </strong>

          <small>
            ${escapeHTML(conversation.time ?? "")}
          </small>
        </div>


        <div class="bean-chat-item__bottom">

          <span class="bean-chat-item__preview">
            ${escapeHTML(
              conversation.preview ||
              "Start a conversation"
            )}
          </span>

          ${
            unread > 0
              ? `
                <span
                  class="bean-chat-item__badge"
                  aria-label="${unread} unread messages"
                >
                  ${unread > 99 ? "99+" : unread}
                </span>
              `
              : ""
          }

        </div>

      </div>

    </button>
  `;
}


/* =========================================================
   EMPTY STATE
   ========================================================= */

function createEmptyState(
  message = "No conversations yet."
) {
  return `
    <div class="bean-list-empty">
      ${escapeHTML(message)}
    </div>
  `;
}


/* =========================================================
   FILTER
   ========================================================= */

function filterConversations(
  conversations,
  query
) {
  const normalized =
    String(query ?? "")
      .trim()
      .toLowerCase();

  if (!normalized) {
    return conversations;
  }

  return conversations.filter(
    (conversation) => {
      const name =
        String(
          conversation.name ?? ""
        ).toLowerCase();

      const preview =
        String(
          conversation.preview ?? ""
        ).toLowerCase();

      const beanId =
        String(
          conversation.beanId ?? ""
        ).toLowerCase();

      return (
        name.includes(normalized) ||
        preview.includes(normalized) ||
        beanId.includes(normalized)
      );
    }
  );
}


/* =========================================================
   RENDER
   ========================================================= */

export function renderChatList(
  query = ""
) {
  const container =
    document.getElementById(
      "conversationList"
    );

  if (!container) {
    return;
  }

  const conversations =
    getConversations();

  const activeChatId =
    getActiveConversationId();

  const filtered =
    filterConversations(
      conversations,
      query
    );

  if (filtered.length === 0) {
    container.innerHTML =
      createEmptyState(
        query
          ? "No chats found."
          : "No conversations yet."
      );

    return;
  }

  container.innerHTML =
    filtered
      .map((conversation) =>
        createChatItem(
          conversation,
          activeChatId
        )
      )
      .join("");
}


/* =========================================================
   ACTIVE CHAT VISUAL STATE
   ========================================================= */

function updateActiveChatUI(
  activeChatId
) {
  document
    .querySelectorAll(
      "[data-chat-id]"
    )
    .forEach((button) => {
      const active =
        button.dataset.chatId ===
        activeChatId;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-current",
        active
          ? "true"
          : "false"
      );
    });
}


/* =========================================================
   MOBILE WORKSPACE
   ========================================================= */

function openMobileWorkspace() {
  const workspace =
    document.querySelector(
      ".bean-workspace"
    );

  if (!workspace) {
    return;
  }

  workspace.classList.add(
    "is-open"
  );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

export function initChatList(
  onSelect
) {
  const list =
    document.getElementById(
      "conversationList"
    );

  const search =
    document.querySelector(
      "[data-chat-search]"
    );

  if (list) {
    list.addEventListener(
      "click",
      (event) => {
        const target =
          event.target;

        if (
          !(target instanceof Element)
        ) {
          return;
        }

        const chatButton =
          target.closest(
            "[data-chat-id]"
          );

        if (!chatButton) {
          return;
        }

        const chatId =
          chatButton.dataset.chatId;

        if (!chatId) {
          return;
        }

        const selected =
          setActiveConversation(
            chatId
          );

        if (!selected) {
          return;
        }

        updateActiveChatUI(
          chatId
        );

        openMobileWorkspace();

        if (
          typeof onSelect ===
          "function"
        ) {
          onSelect(chatId);
        }
      }
    );
  }


  /* =======================================================
     SEARCH
     ======================================================= */

  if (search) {
    search.addEventListener(
      "input",
      (event) => {
        renderChatList(
          event.target.value
        );
      }
    );
  }
}
