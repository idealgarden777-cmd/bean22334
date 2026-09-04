/* ================================================================= *
 * Message List Component - src/components/message-list.js           *
 * ================================================================= */

import { store } from '../core/store.js';

export function renderMessageList() {
  const container = document.createElement('div');
  container.className = 'message-list-container';
  container.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    background-color: var(--bg-bone);
  `;

  function updateMessages() {
    container.innerHTML = '';
    const state = store.getState();
    const messages = state.messages || [];

    if (messages.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        text-align: center;
        color: var(--text-espresso);
        opacity: 0.5;
        margin: auto;
        font-size: 14px;
      `;
      emptyState.textContent = 'No messages yet. Start the conversation!';
      container.appendChild(emptyState);
      return;
    }

    messages.forEach(msg => {
      const bubble = document.createElement('div');
      const isUser = msg.sender === 'user';

      bubble.style.cssText = `
        max-width: 70%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 14px;
        line-height: 20px;
        word-break: break-word;
        box-sizing: border-box;
        align-self: ${isUser ? 'flex-end' : 'flex-start'};
        background-color: ${isUser ? 'var(--accent-sage)' : 'var(--surface-sand)'};
        color: ${isUser ? '#FFFFFF' : 'var(--text-espresso)'};
        border: ${isUser ? 'none' : '1px solid rgba(44, 37, 35, 0.08)'};
      `;
      bubble.textContent = msg.text;

      container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
  }

  updateMessages();
  container.updateMessages = updateMessages;

  return container;
}
```[cite: 2]
