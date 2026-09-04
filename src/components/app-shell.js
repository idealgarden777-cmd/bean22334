import { store } from '../core/store.js';
import { renderSidebar } from './sidebar.js';
import { renderChatView } from './chat-view.js';
import { renderContactPanel } from './contact-panel.js';

export function renderAppShell(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar-container" id="sidebar-slot"></aside>
      <main class="chat-view-container" id="chat-view-slot"></main>
      <aside class="contact-panel-container" id="contact-panel-slot"></aside>
    </div>
  `;

  const sidebarSlot = container.querySelector('#sidebar-slot');
  const chatViewSlot = container.querySelector('#chat-view-slot');
  const contactPanelSlot = container.querySelector('#contact-panel-slot');

  const renderUI = (state) => {
    if (sidebarSlot) {
      renderSidebar(sidebarSlot, state);
    }
    if (chatViewSlot) {
      renderChatView(chatViewSlot, state);
    }
    if (contactPanelSlot) {
      renderContactPanel(contactPanelSlot, state);
    }
  };

  // Initial render
  renderUI(store.getState());

  // Subscribe to state updates
  store.subscribe((updatedState) => {
    renderUI(updatedState);
  });
}

export default renderAppShell;
