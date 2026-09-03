"use strict";

import { createSidebar } from "./sidebar.js";

/* =========================================================
   BEAN — APP SHELL
   Master application layout
   ========================================================= */


/* =========================================================
   CHAT LIST PANEL
   ========================================================= */

function createChatListPanel() {
  return `
    <aside
      class="bean-chat-list"
      aria-label="Conversations"
    >
      <header class="bean-chat-list__header">
        <div class="bean-chat-list__title-row">
          <div>
            <span class="bean-chat-list__eyebrow">
              Messages
            </span>

            <h1 class="bean-chat-list__title">
              Chats
            </h1>
          </div>

          <button
            class="bean-icon-button bean-chat-list__new"
            type="button"
            aria-label="Start a new chat"
            data-new-chat
          >
            <span aria-hidden="true">＋</span>
          </button>
        </div>

        <label class="bean-search">
          <span
            class="bean-search__icon"
            aria-hidden="true"
          >
            ⌕
          </span>

          <input
            class="bean-search__input"
            type="search"
            placeholder="Search chats"
            autocomplete="off"
            aria-label="Search conversations"
            data-chat-search
          >
        </label>
      </header>

      <div
        class="bean-chat-list__items"
        id="conversationList"
        aria-label="Chat list"
      ></div>
    </aside>
  `;
}


/* =========================================================
   EMPTY CHAT STATE
   ========================================================= */

function createEmptyChatView() {
  return `
    <main
      class="bean-chat"
      id="chatView"
      aria-label="Current conversation"
    >
      <section class="bean-empty">
        <div class="bean-empty__content">
          <div
            class="bean-empty__mark"
            aria-hidden="true"
          >
            B
          </div>

          <h2 class="bean-empty__title">
            Welcome to Bean
          </h2>

          <p class="bean-empty__text">
            Select a conversation to start messaging.
          </p>

          <button
            class="bean-button bean-button--brand bean-empty__action"
            type="button"
            data-new-chat
          >
            <span aria-hidden="true">＋</span>
            <span>New chat</span>
          </button>
        </div>
      </section>
    </main>
  `;
}


/* =========================================================
   DETAILS PANEL SLOT
   ========================================================= */

function createDetailsSlot() {
  return `
    <aside
      class="bean-details-slot"
      id="contactPanelSlot"
      aria-label="Conversation details"
      hidden
    ></aside>
  `;
}


/* =========================================================
   APP SHELL
   ========================================================= */

export function createAppShell() {
  return `
    <div class="bean-app">
      <div class="bean-shell">

        ${createSidebar("chats")}

        ${createChatListPanel()}

        <section class="bean-workspace">
          ${createEmptyChatView()}
          ${createDetailsSlot()}
        </section>

      </div>
    </div>
  `;
}
