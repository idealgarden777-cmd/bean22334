import { store } from "../core/store.js";
import { renderChatList, initChatList } from "./chat-list.js";

export function renderSidebar(container) {
  const state = store.getState();

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
  chatList.innerHTML = renderChatList();
}

export function initSidebar(container) {
  renderSidebar(container);

  store.subscribe(() => {
    const chatList = container.querySelector(".chat-list");
    if (chatList) {
      chatList.innerHTML = renderChatList();
    }
  });
}
