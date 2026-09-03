"use strict";

/*
=========================================================
BEAN — APP SHELL
=========================================================

Owns:
- Main application layout
- Sidebar placement
- Conversation panel
- Main chat area

Does not own:
- Sidebar behavior
- Conversation data
- Messages
- Backend
- Authentication
=========================================================
*/

import { createSidebar } from "./sidebar.js";

/*
=========================================================
CHAT LIST PANEL
=========================================================
*/

function createChatListPanel() {
  return `
    <section
      class="bean-chat-list"
      aria-label="Conversations"
    >

      <header class="bean-chat-list__header">

        <div class="bean-chat-list__heading">
          <h1 class="bean-chat-list__title">
            Chats
          </h1>
        </div>

        <div class="bean-chat-list__search">

          <label class="bean-search">

            <span
              class="bean-search__icon"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="11" cy="11" r="7"></circle>
                <path d="m20 20-4-4"></path>
              </svg>
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

        </div>

      </header>

      <div
        class="bean-chat-list__items"
        id="conversationList"
        role="list"
        aria-label="Chat list"
      ></div>

    </section>
  `;
}

/*
=========================================================
EMPTY CHAT VIEW
=========================================================
*/

function createEmptyChatView() {
  return `
    <main
      class="bean-chat"
      id="chatView"
      aria-label="Current conversation"
    >

      <div class="bean-empty">

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

        </div>

      </div>

    </main>
  `;
}

/*
=========================================================
APP SHELL
=========================================================
*/

export function createAppShell() {
  return `
    <div class="bean-shell">

      ${createSidebar("chats")}

      ${createChatListPanel()}

      ${createEmptyChatView()}

    </div>
  `;
}
