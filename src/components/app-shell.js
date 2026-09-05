import { Sidebar } from './sidebar.js';
import { ChatView } from './chat-view.js';
import { ContactPanel } from './contact-panel.js';

export function AppShell() {
  // Create the main app shell container
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // Instantiate components
  const sidebarElement = Sidebar();
  const chatViewElement = ChatView();
  const contactPanelElement = ContactPanel();

  // Append components to the main shell in correct order
  shell.appendChild(sidebarElement);
  shell.appendChild(chatViewElement);
  shell.appendChild(contactPanelElement);

  return shell;
}
