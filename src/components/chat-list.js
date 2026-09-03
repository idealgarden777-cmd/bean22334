"use strict";

/* =========================================================
   BEAN — CHAT LIST
   Conversations + search + active selection
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

  const online =
    conversation.status === "online";

  const initials =
    conversation.initials ||
    getInitials(conversation.name);

  const unread =
    Number(conversation.unread || 0);

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

        ${
          online
            ? `
              <span
                class="bean-presence is-online"
                aria-hidden="true"
              ></span>
            `
            : ""
        }

      </div>


      <div class="bean-chat-item__body">

        <div class="bean-chat-item__top">

          <strong>
            ${escapeHTML(conversation.name)}
          </strong>

          <small>
            ${escapeHTML(conversation.time || "")}
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
   FILTER
   ========================================================= */

function filterConversations(
  conversations,
  query
) {
  const value = String(query ?? "")
    .trim()
    .toLowerCase();

  if (!value) {
    return conversations;
  }

  return conversations.filter(
    (conversation) => {
      const name =
        String(
          conversation.name ?? ""
        ).toLowerCase();

      const beanId =
        String(
          conversation.beanId ?? ""
        ).toLowerCase();

      const preview =
        String(
          conversation.preview ?? ""
        ).toLowerCase();

      return (
        name.includes(value) ||
        beanId.includes(value) ||
        preview.includes(value)
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
    container.innerHTML = `
      <div class="bean-list-empty">
        ${
          query
            ? "No chats found."
            : "No conversations yet."
        }
      </div>
    `;

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
   ACTIVE UI
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

  workspace?.classList.add(
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


  /* ---------------------------------------------------------
     SELECT CONVERSATION
     --------------------------------------------------------- */

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

        const button =
          target.closest(
            "[data-chat-id]"
          );

        if (!button) {
          return;
        }

        const chatId =
          button.dataset.chatId;

        if (!chatId) {
          return;
        }

        if (
          !setActiveConversation(chatId)
        ) {
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


  /* ---------------------------------------------------------
     SEARCH
     --------------------------------------------------------- */

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
