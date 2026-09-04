/* =================================================================
   Message List Component - Avatars, custom padding & check-ticks[cite: 1]
   ================================================================ */

import { store } from '../core/store.js';

export function renderMessageList(container) {
  const state = store.getState();
  const messages = state.messages[state.activeContactId] || [];
  const activeContact = state.contacts.find(c => c.id === state.activeContactId) || state.contacts[0];

  container.innerHTML = `
    <div class="message-list-container">
      ${messages.length === 0 ? `
        <div class="empty-chat-state">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ` : messages.map(msg => {
        const isMe = msg.senderId === state.currentUser.id;
        const avatarUrl = isMe ? state.currentUser.avatar : activeContact.avatar;
        
        return `
          <div class="message-item ${isMe ? 'message-sent' : 'message-received'}">
            {!isMe ? `<img src="${avatarUrl}" alt="Avatar" class="message-avatar" />` : ''}
            <div class="message-bubble-wrapper">
              <div class="message-bubble">
                <p class="message-text">${msg.text}</p>
                <div class="message-meta">
                  <span class="message-time">${msg.timestamp}</span>
                  ${isMe ? `
                    <span class="message-ticks ${msg.status === 'read' ? 'read' : ''}">
                      <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
                        <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
            {isMe ? `<img src="${avatarUrl}" alt="Avatar" class="message-avatar" />` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Auto scroll to bottom
  container.scrollTop = container.scrollHeight;
}

const messageListStyles = document.createElement('style');
messageListStyles.textContent = `
  .message-list-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .empty-chat-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-muted);
    font-size: var(--font-size-sm);
  }

  .message-item {
    display: flex;
    align-items: flex-end;
    gap: var(--space-1);
    max-width: 75%;
  }

  .message-received {
    align-self: flex-start;
  }

  .message-sent {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-avatar); /* 9999px profile avatars[cite: 1] */
    object-fit: cover;
    margin-bottom: 4px;
  }

  .message-bubble {
    background-color: var(--color-surface); /* Soft Sand for cards/surfaces[cite: 1] */
    color: var(--color-text-primary); /* Deep Espresso Brown[cite: 1] */
    padding: 10px 14px;
    border-radius: var(--radius-bubble); /* 10px to 12px for chat bubbles[cite: 1] */
    box-shadow: var(--shadow-subtle);
  }

  .message-sent .message-bubble {
    background-color: var(--color-accent); /* Muted Sage Green / Terracotta accent[cite: 1] */
    color: var(--color-white);
  }

  .message-text {
    font-size: var(--font-size-sm); /* 14px body text[cite: 1] */
    line-height: 1.4;
    word-break: break-word;
  }

  .message-meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    margin-top: 4px;
  }

  .message-time {
    font-size: var(--font-size-xs); /* 12px timestamps[cite: 1] */
    color: var(--color-muted);
  }

  .message-sent .message-time {
    color: rgba(255, 255, 255, 0.8);
  }

  .message-ticks {
    color: rgba(255, 255, 255, 0.6);
    display: inline-flex;
  }

  .message-ticks.read {
    color: #ffffff;
  }
`;
document.head.appendChild(messageListStyles);
