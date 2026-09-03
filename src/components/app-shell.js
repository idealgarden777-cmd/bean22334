"use strict";

/*
=========================================================
BEAN — APP SHELL
=========================================================

Owns:
- Main application structure
- Primary navigation
- Conversation list container
- Main chat container

Does not own:
- Conversation data
- Messages
- Backend
- Authentication
- Realtime
=========================================================
*/

export function createAppShell() {
  return `
    <div class="bean-shell">

      <!-- SIDEBAR -->
      <aside
        class="bean-sidebar"
        aria-label="Main navigation"
      >
        <div
          class="bean-sidebar__logo"
          aria-label="Bean"
          title="Bean"
        >
          B
        </div>

        <nav
          class="bean-sidebar__nav"
          aria-label="Bean navigation"
        >
          <button
            class="bean-nav-button is-active"
            type="button"
            data-nav="chats"
            aria-label="Chats"
            title="Chats"
          >
            <span aria-hidden="true">💬</span>
          </button>

          <button
            class="bean-nav-button"
            type="button"
            data-nav="contacts"
            aria-label="Contacts"
            title="Contacts"
          >
            <span aria-hidden="true">👤</span>
          </button>

          <button
            class="bean-nav-button"
            type="button"
            data-nav="search"
            aria-label="Search"
            title="Search"
          >
            <span aria-hidden="true">⌕</span>
          </button>
        </nav>

        <div class="bean-sidebar__bottom">
          <button
            class="bean-nav-button"
            type="button"
            data-nav="settings"
            aria-label="Settings"
            title="Settings"
          >
            <span aria-hidden="true">⚙</span>
          </button>

          <button
            class="bean-nav-button"
            type="button"
            data-nav="profile"
            aria-label="Profile"
            title="Profile"
          >
            <span
              class="bean-avatar"
              aria-hidden="true"
            >
              SY
            </span>
          </button>
        </div>
      </aside>

      <!-- CHAT LIST -->
      <section
        class="bean-chat-list"
        aria-label="Conversations"
      >
        <header class="bean-chat-list__header">
          <h1 class="bean-chat-list__title">
            Chats
          </h1>

          <div class="bean-chat-list__search">
            <label class="bean-search">
              <span aria-hidden="true">⌕</span>

              <input
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

      <!-- CHAT VIEW -->
      <main
        class="bean-chat"
        id="chatView"
        aria-label="Current conversation"
      >
        <div class="bean-empty">
          <div class="bean-empty__content">
            <h2 class="bean-empty__title">
              Welcome to Bean
            </h2>

            <p class="bean-empty__text">
              Select a conversation to start messaging.
            </p>
          </div>
        </div>
      </main>

    </div>
  `;
}
