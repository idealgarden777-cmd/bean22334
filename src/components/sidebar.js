import { store } from '../core/store.js';
import { renderChatList } from './chat-list.js';

export function renderSidebar(container, state) {
  if (!container) return;

  container.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>Messages</h2>
      </div>
      <div class="sidebar-search">
        <input 
          type="text" 
          id="search-input" 
          placeholder="Search chats..." 
          value="${state.searchQuery || ''}"
        />
      </div>
      <div id="chat-list-slot"></div>
    </div>
  `;

  const searchInput = container.querySelector('#search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      store.setSearchQuery(e.target.value);
    });
  }

  const chatListSlot = container.querySelector('#chat-list-slot');
  if (chatListSlot) {
    renderChatList(chatListSlot, state);
  }
}

export default renderSidebar;
