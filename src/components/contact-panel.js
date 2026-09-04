/* =================================================================
   Contact Panel Component - Side panel for profile and media info
   ================================================================ */

import { store } from '../core/store.js';

export function renderContactPanel(container) {
  const state = store.getState();
  const activeContact = state.contacts.find(c => c.id === state.activeContactId) || state.contacts[0];

  container.innerHTML = `
    <div class="contact-panel-container">
      <div class="panel-header">
        <h3>Contact Info</h3>
        <button class="close-panel-btn" id="closePanelBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="panel-profile-content">
        <img src="${activeContact.avatar}" alt="${activeContact.name}" class="panel-avatar" />
        <h4 class="panel-name">${activeContact.name}</h4>
        <p class="panel-status">${activeContact.status}</p>
      </div>
      <div class="panel-section">
        <span class="section-title">Shared Media & Files</span>
        <div class="media-grid">
          <div class="media-thumb">Hardscape.pdf</div>
          <div class="media-thumb">Layout.png</div>
        </div>
      </div>
    </div>
  `;

  const closeBtn = container.querySelector('#closePanelBtn');
  closeBtn.addEventListener('click', () => {
    store.toggleContactPanel();
  });
}

const contactPanelStyles = document.createElement('style');
contactPanelStyles.textContent = `
  .contact-panel-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--space-2);
    background-color: var(--color-surface);
    color: var(--color-text-primary);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-header h3 {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
  }

  .close-panel-btn {
    color: var(--color-muted);
    padding: 4px;
    border-radius: var(--radius-button);
    transition: var(--transition-smooth);
  }

  .close-panel-btn:hover {
    color: var(--color-text-primary);
    background-color: rgba(44, 37, 35, 0.05);
  }

  .panel-profile-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .panel-avatar {
    width: 80px;
    height: 80px;
    border-radius: var(--radius-avatar);
    object-fit: cover;
    margin-bottom: var(--space-1);
  }

  .panel-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    margin-bottom: 2px;
  }

  .panel-status {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
  }

  .panel-section {
    margin-top: var(--space-2);
  }

  .section-title {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .media-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: var(--space-1);
  }

  .media-thumb {
    background-color: var(--color-bg);
    padding: 12px;
    border-radius: var(--radius-button);
    font-size: var(--font-size-xs);
    text-align: center;
    border: 1px solid var(--color-border);
    color: var(--color-muted);
  }
`;
document.head.appendChild(contactPanelStyles);
