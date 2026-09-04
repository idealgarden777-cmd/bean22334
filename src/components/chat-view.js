/* ================================================================= *
 * Chat View Component - src/components/chat-view.js                 *
 * ================================================================= */

import { store } from '../core/store.js';
import { renderChatHeader } from './chat-header.js';
import { renderMessageList } from './message-list.js';
import { renderComposer } from './composer.js';

export function renderChatView() {
  const container = document.createElement('div');
  container.className = 'chat-view';
  container.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-bone);
    min-width: 0;
    box-sizing: border-box;
  `;

  const state = store.getState();
  const activeContact = state.activeContact;

  if (!activeContact) {
    const emptyState = document.createElement('div');
    emptyState.style.cssText = `
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-espresso);
      opacity: 0.5;
      font-size: 14px;
    `;
    emptyState.textContent = 'Select a conversation to start messaging';
    container.appendChild(emptyState);
    return container;
  }

  const header = renderChatHeader(activeContact);
  const messageList = renderMessageList();
  const composer = renderComposer();

  container.appendChild(header);
  container.appendChild(messageList);
  container.appendChild(composer);

  return container;
}
```[cite: 2]
