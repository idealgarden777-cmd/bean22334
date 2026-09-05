// src/components/chat-list.js
import { store } from '../core/store.js';

export function renderChatList() {
  const container = document.createElement('div');
  container.className = 'chat-list-pane';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';
  container.style.background = '#1e293b';

  // Search or Header inside list
  const searchBox = document.createElement('div');
  searchBox.style.padding = '12px';
  searchBox.innerHTML = `
    <input type="text" placeholder="Search chats..." style="
      width: 100%;
      padding: 8px 12px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #f8fafc;
      outline: none;
      box-sizing: border-box;
    ">
  `;
  container.appendChild(searchBox);

  // List items wrapper
  const listItems = document.createElement('div');
  listItems.style.flex = '1';
  listItems.style.overflowY = 'auto';
  listItems.style.padding = '0 8px 8px 8px';

  // Get state data safely
  const state = store.getState ? store.getState() : { conversations: [] };
  const conversations = state.conversations || [
    { id: '1', name: 'General Channel', lastMessage: 'Welcome to Bean Chat!', time: 'Just now' },
    { id: '2', name: 'Development Team', lastMessage: 'Build is passing successfully!', time: '2m ago' }
  ];

  conversations.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-list-item';
    item.style.padding = '10px 12px';
    item.style.marginBottom = '6px';
    item.style.borderRadius = '6px';
    item.style.cursor = 'pointer';
    item.style.transition.background = '0.2s';
    
    item.innerHTML = `
      <div style="font-weight: 600; color: #f8fafc; font-size: 0.95rem;">${chat.name}</div>
      <div style="font-size: 0.8rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${chat.lastMessage || 'Tap to view messages'}</div>
    `;

    item.addEventListener('mouseenter', () => { item.style.background = '#334155'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

    item.addEventListener('click', () => {
      if (store.setActiveConversation) {
        store.setActiveConversation(chat.id);
      }
    });

    listItems.appendChild(item);
  });

  container.appendChild(listItems);
  return container;
}
