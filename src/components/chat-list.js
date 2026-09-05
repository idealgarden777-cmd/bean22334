// src/components/chat-list.js
import { store } from '../core/store.js';

export function renderChatList() {
  const container = document.createElement('div');
  container.className = 'chat-list';
  
  const state = store.getState();
  
  state.contacts.forEach(contact => {
    const item = document.createElement('div');
    item.className = 'chat-list-item';
    item.textContent = contact.name;
    
    item.addEventListener('click', () => {
      store.setActiveContact(contact.id);
    });
    
    container.appendChild(item);
  });

  return container;
}
