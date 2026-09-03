"use strict";

import { createSidebar } from "./sidebar.js";

function createChatListPanel() {
  return `
    <section class="bean-chat-list" aria-label="Conversations">
      <header class="bean-chat-list__header">
        <div class="bean-chat-list__heading">
          <h1 class="bean-chat-list__title">Chats</h1>
        </div>

        <label class="bean-search">
          <span class="bean-search__icon" aria-hidden="true">⌕</span>

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
    </section>
  `;
}

function createEmptyChatView() {
  return `
    <main
      class="bean-chat"
      id="chatView"
      aria-label="Current conversation"
    >
      <div class="bean-empty">
        <div class="bean-empty__content">
          <div class="bean-empty__mark" aria-hidden="true">
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

export function createAppShell() {
  return `
    <div class="bean-app">
      <div class="bean-shell">
        ${createSidebar("chats")}
        ${createChatListPanel()}
        ${createEmptyChatView()}
      </div>
    </div>
  `;
}
