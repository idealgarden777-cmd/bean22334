"use strict";

/*
=========================================================
BEAN — APP SHELL
=========================================================

Owns:
- Main application structure
- Navigation sidebar
- Conversation list container
- Main chat container

Does not own:
- Backend
- Authentication
- Realtime
- Message logic
- Search logic
=========================================================
*/

export function createAppShell() {
  return `
    <div class="bean-shell">

      <!-- ================================================
           SIDEBAR
           ================================================ -->

      <aside class="bean-sidebar" aria-label="Main navigation">

        <div class="bean-sidebar__logo" aria-label="Bean">
          B
        </div>

        <nav class="bean-sidebar__nav">

          <button
            class="bean-nav-button is-active"
            type="button"
            aria-label="Chats"
            title="Chats"
            data-nav="chats"
          >
            <span aria-hidden="true">💬</span>
          </button>

          <button
            class="bean-nav-button"
            type="button"
            aria-label="Contacts"
            title="Contacts"
            data-nav="contacts"
          >
            <span aria-hidden="true">👤</span>
          </button>

          <button
            class="bean-nav-button"
            type="button"
            aria-label="Search"
            title="Search"
            data-nav="search"
          >
            <span aria-hidden="true">⌕</span>
          </button>

        </nav>

        <div class="bean-sidebar__bottom">

          <button
            class="bean-nav-button"
            type="button"
            aria-label="Settings"
            title="Settings"
            data-nav="settings"
          >
            <span aria-hidden="true">⚙</span>
          </button>

          <button
            class="bean-nav-button"
            type="button"
            aria-label="Profile"
            title="Profile"
            data-nav="profile"
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


      <!-- ================================================
           CONVERSATIONS
           ================================================ -->

      <section
        class="bean-chat-list"
        aria-label="Conversations"
      >

        <header class="bean-chat-list__header">

          <h1 class="bean-chat-list__title">
            Chats
          </h1>

          <div class="bean-chat-list__search">

            <label
              class="bean-search"
              aria-label="Search conversations"
            >
              <span aria-hidden="true">⌕</span>

              <input
                type="search"
                placeholder="Search"
                autocomplete="off"
                data-chat-search
              >
            </label>

          </div>

        </header>

        <div
          class="bean-chat-list__items"
          id="conversationList"
        ></div>

      </section>


      <!-- ================================================
           MAIN CHAT
           ================================================ -->

      <main
        class="bean-chat"
        id="chatView"
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
