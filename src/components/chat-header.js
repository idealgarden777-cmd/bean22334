/* =================================================================
   Chat Header Component - Fixed height layout with actions[cite: 1]
   ================================================================ */

import { store } from '../core/store.js';

export function renderChatHeader(container) {
  const state = store.getState();
  const activeContact = state.contacts.find(c => c.id === state.activeContactId) || state.contacts[0];

  container.innerHTML = `
    <div class="chat-header-container">
      <div class="chat-header-participant">
        <img src="${activeContact.avatar}" alt="${activeContact.name}" class="contact-avatar" />
        <div class="participant-info">
          <span class="participant-name">${activeContact.name}</span>
          <span class="participant-status">${activeContact.status}</span>
        </div>
      </div>
      <div class="chat-header-actions">
        <button class="header-action-btn" title="Voice Call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>
        <button class="header-action-btn" title="Video Call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
        <button class="header-action-btn" id="menuActionBtn" title="Action Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

const chatHeaderStyles = document.createElement('style');
chatHeaderStyles.textContent = `
  .chat-header-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px; /* Fixed height layout */
    padding: 0 var(--space-3);
    background-color: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .chat-header-participant {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .participant-info {
    display: flex;
    flex-direction: column;
  }

  .participant-name {
    font-size: var(--font-size-base); /* 16px main headings and chat names[cite: 1] */
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
  }

  .participant-status {
    font-size: var(--font-size-xs); /* 12px status badges[cite: 1] */
    color: var(--color-muted);
  }

  .chat-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-action-btn {
    padding: 10px;
    border-radius: var(--radius-button);
    color: var(--color-muted);
    background-color: var(--color-surface);
    transition: var(--transition-smooth);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-action-btn:hover {
    background-color: rgba(90, 107, 92, 0.15);
    color: var(--color-accent);
  }
`;
document.head.appendChild(chatHeaderStyles);
