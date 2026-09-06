import { store } from "../core/store.js";

export function renderChatHeader(container) {
  const state = store.getState();

  const contact =
    state.contacts.find(
      (item) => item.id === state.activeContactId
    ) || state.contacts[0];

  container.innerHTML = `
    <header class="chat-header-container">
      <div class="chat-header-participant">
        <img
          src="${contact.avatar}"
          alt="${contact.name}"
          class="contact-avatar"
        />

        <div class="participant-info">
          <span class="participant-name">${contact.name}</span>
          <span class="participant-status">${contact.status}</span>
        </div>
      </div>

      <div class="chat-header-actions">
        <button class="header-action-btn" type="button" aria-label="Voice call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2
            19.79 19.79 0 0 1-8.63-3.07
            19.5 19.5 0 0 1-6-6
            19.79 19.79 0 0 1-3.07-8.67
            A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2
            1.72c.12.94.36 1.86.7 2.76
            a2 2 0 0 1-.45 2.11L8.09 9.91
            a16 16 0 0 0 6 6l1.27-1.27
            a2 2 0 0 1 2.11-.45
            c.9.34 1.82.58 2.76.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </button>

        <button class="header-action-btn" type="button" aria-label="Video call">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>

        <button class="header-action-btn" type="button" aria-label="More options">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
    </header>
  `;
}
