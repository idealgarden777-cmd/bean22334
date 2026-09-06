import { store } from "../core/store.js";

export function renderChatHeader(container) {
  const state = store.getState();

  const activeContact =
    state.contacts.find(
      (contact) => contact.id === state.activeContactId
    ) || state.contacts[0];

  container.innerHTML = `
    <div class="chat-header-container">
      <div class="chat-header-participant">
        <img
          src="${activeContact.avatar}"
          alt="${activeContact.name}"
          class="contact-avatar"
        />

        <div class="participant-info">
          <span class="participant-name">${activeContact.name}</span>
          <span class="participant-status">${activeContact.status}</span>
        </div>
      </div>

      <div class="chat-header-actions">
        <button class="header-action-btn" type="button" title="Voice Call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2
            19.79 19.79 0 0 1-8.63-3.07
            19.5 19.5 0 0 1-6-6
            19.79 19.79 0 0 1-3.07-8.67
            A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2
            1.72 12.84 12.84 0 0 0 .7 2.81
            2 2 0 0 1-.45 2.11L8.09 9.91
            a16 16 0 0 0 6 6l1.27-1.27
            a2 2 0 0 1 2.11-.45
            12.84 12.84 0 0 0 2.81.7
            A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>

        <button class="header-action-btn" type="button" title="Video Call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>

        <button
          class="header-action-btn"
          id="menuActionBtn"
          type="button"
          title="Action Menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

const chatHeaderStyles = document.createElement("style");

chatHeaderStyles.textContent = `
  .chat-header-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
    padding: 0 16px;
    background: var(--color-bg, #fbf9f5);
    border-bottom: 1px solid var(--color-border, #e7e1d8);
  }

  .chat-header-participant {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .contact-avatar {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    object-fit: cover;
    border-radius: 9999px;
  }

  .participant-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .participant-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text, #2c2523);
  }

  .participant-status {
    margin-top: 2px;
    font-size: 12px;
    color: var(--color-text-secondary, #8a817b);
  }

  .chat-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-action-btn {
    width: 38px;
    height: 38px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: var(--color-text-secondary, #8a817b);
    background: transparent;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease;
  }

  .header-action-btn:hover {
    background: var(--color-surface-soft, #f2ece1);
    color: var(--color-text, #2c2523);
  }
`;

document.head.appendChild(chatHeaderStyles);
