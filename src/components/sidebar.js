import { initChatList } from "./chat-list.js";

export function renderSidebar(container) {
  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <span class="sidebar-title">Bean</span>
        </div>

        <button
          type="button"
          class="sidebar-new-btn"
          title="New Chat"
          aria-label="New Chat"
        >
          +
        </button>
      </div>

      <div class="sidebar-search">
        <input
          type="search"
          placeholder="Search chats"
          aria-label="Search chats"
        />
      </div>

      <div class="sidebar-section-title">Chats</div>

      <div class="chat-list"></div>
    </aside>
  `;

  const chatList = container.querySelector(".chat-list");
  initChatList(chatList);
}

export function initSidebar(container) {
  renderSidebar(container);
}
