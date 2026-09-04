/* =================================================================
   App Shell Component - Main Layout Container
   ================================================================ */

import { store } from '../core/store.js';
import { renderSidebar } from './sidebar.js';
import { renderChatView } from './chat-view.js';
import { renderContactPanel } from './contact-panel.js';

export function renderAppShell(container) {
  const updateLayout = (state) => {
    container.innerHTML = `
      <div class="app-shell-container">
        <aside class="app-sidebar-wrapper"></aside>
        <main class="app-chat-wrapper"></main>
        <aside class="app-contact-wrapper ${state.isContactPanelOpen ? 'open' : 'closed'}"></aside>
      </div>
    `;

    // Mount sub-components
    const sidebarEl = container.querySelector('.app-sidebar-wrapper');
    const chatEl = container.querySelector('.app-chat-wrapper');
    const contactEl = container.querySelector('.app-contact-wrapper');

    renderSidebar(sidebarEl);
    renderChatView(chatEl);
    renderContactPanel(contactEl);
  };

  // Initial render
  updateLayout(store.getState());

  // Subscribe to state changes
  store.subscribe(updateLayout);
}

// Add App Shell CSS structure inline or via app.css
const appShellStyles = document.createElement('style');
appShellStyles.textContent = `
  .app-shell-container {
    display: flex;
    width: 100vw;
    height: 100vh;
    background-color: var(--color-bg);
    color: var(--color-text-primary);
    font-family: var(--font-family);
    overflow: hidden;
  }
  
  .app-sidebar-wrapper {
    width: 320px;
    height: 100%;
    border-right: 1px solid var(--color-border);
    background-color: var(--color-bg);
  }

  .app-chat-wrapper {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg);
  }

  .app-contact-wrapper {
    width: 280px;
    height: 100%;
    border-left: 1px solid var(--color-border);
    background-color: var(--color-surface);
    transition: transform 0.3s ease;
  }

  .app-contact-wrapper.closed {
    display: none;
  }
`;
document.head.appendChild(appShellStyles);
