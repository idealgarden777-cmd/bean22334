import { store } from '../core/store.js';

export function renderChatList() {
  const container = document.createElement('div');
  container.className = 'chat-list';
  return container;
}
