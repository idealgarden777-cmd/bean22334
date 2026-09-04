/* =================================================================
   Composer Component - Pill-shaped input with attachment and arrow send button[cite: 1]
   ================================================================ */

import { store } from '../core/store.js';

export function renderComposer(container) {
  container.innerHTML = `
    <form class="composer-form" id="composerForm">
      <div class="composer-pill-container">
        <button type="button" class="composer-action-btn" id="attachBtn" title="Attach File">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <input type="text" id="messageInput" placeholder="Type a message..." autocomplete="off" />
        <button type="submit" class="composer-send-btn" title="Send Message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </form>
  `;

  const form = container.querySelector('#composerForm');
  const input = container.querySelector('#messageInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    if (text.trim()) {
      store.sendMessage(text);
      input.value = '';
    }
  });
}

const composerStyles = document.createElement('style');
composerStyles.textContent = `
  .composer-form {
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }

  .composer-pill-container {
    display: flex;
    align-items: center;
    background-color: var(--color-surface); /* Soft Sand surface[cite: 1] */
    border-radius: var(--radius-pill);
    padding: 6px 8px 6px 12px;
    border: 1px solid transparent;
    transition: var(--transition-smooth);
    box-shadow: var(--shadow-subtle);
  }

  .composer-pill-container:focus-within {
    border-color: var(--color-border-focus);
  }

  .composer-action-btn {
    color: var(--color-muted);
    padding: 8px;
    border-radius: var(--radius-avatar);
    transition: var(--transition-smooth);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .composer-action-btn:hover {
    color: var(--color-accent);
    background-color: rgba(90, 107, 92, 0.1);
  }

  #messageInput {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 12px;
    font-size: var(--font-size-sm); /* 14px body text[cite: 1] */
    color: var(--color-text-primary); /* Deep Espresso Brown[cite: 1] */
    outline: none;
  }

  .composer-send-btn {
    background-color: var(--color-accent); /* Muted Sage Green / Terracotta[cite: 1] */
    color: var(--color-white);
    width: 38px;
    height: 38px;
    border-radius: var(--radius-button); /* 10px-12px or rounded button[cite: 1] */
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-smooth);
    box-shadow: var(--shadow-subtle);
  }

  .composer-send-btn:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }
`;
document.head.appendChild(composerStyles);
