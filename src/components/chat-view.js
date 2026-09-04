/* =================================================================
   Chat View Component - Assembles header, message list, and composer
   ================================================================ */

import { renderChatHeader } from './chat-header.js';
import { renderMessageList } from './message-list.js';
import { renderComposer } from './composer.js';

export function renderChatView(container) {
  container.innerHTML = `
    <div class="chat-view-container">
      <div class="chat-header-slot"></div>
      <div class="message-list-slot"></div>
      <div class="composer-slot"></div>
    </div>
  `;

  renderChatHeader(container.querySelector('.chat-header-slot'));
  renderMessageList(container.querySelector('.message-list-slot'));
  renderComposer(container.querySelector('.composer-slot'));
}

const chatViewStyles = document.createElement('style');
chatViewStyles.textContent = `
  .chat-view-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: var(--color-bg);
  }
`;
document.head.appendChild(chatViewStyles);
