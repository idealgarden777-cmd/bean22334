import { renderChatList, initChatList } from "./chat-list.js";

export function renderSidebar(container) {
  container.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2>Chats</h2>
      </div>

      <div class="chat-list"></div>
    </aside>
  `;

  const chatList = container.querySelector(".chat-list");

  initChatList(chatList);
}

export function initSidebar(container) {
  renderSidebar(container);
}
