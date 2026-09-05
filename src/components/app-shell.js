/**
 * ====================================================
 * BEAN — APP SHELL COMPONENT
 * ====================================================
 * Manages the main layout shell, combining sidebar,
 * chat view, and contact panel into a flex container.
 */

import { Sidebar } from './sidebar.js';
import { ChatView } from './chat-view.js';
import { ContactPanel } from './contact-panel.js';

export function AppShell(store) {
  // Create main app shell container
  const shellElement = document.createElement('div');
  shellElement.className = 'app-shell';
  shellElement.setAttribute('role', 'region');
  shellElement.setAttribute('aria-label', 'Chat Application');

  // Initialize core structural components
  const sidebarElement = Sidebar(store);
  const chatViewElement = ChatView(store);
  const contactPanelElement = ContactPanel(store);

  // Append children in correct structural order
  shellElement.appendChild(sidebarElement);
  shellElement.appendChild(chatViewElement);
  shellElement.appendChild(contactPanelElement);

  return shellElement;
}
