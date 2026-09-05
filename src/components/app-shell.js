import { Sidebar } from './sidebar.js';
import { ChatView } from './chat-view.js';
import { ContactPanel } from './contact-panel.js';

export function AppShell(store) {
  // Main container jo app.css ke .app-shell class ko use karega
  const shellElement = document.createElement('div');
  shellElement.className = 'app-shell';

  // Render child components and append them to the flex container
  const sidebar = Sidebar(store);
  const chatView = ChatView(store);
  const contactPanel = ContactPanel(store);

  shellElement.appendChild(sidebar);
  shellElement.appendChild(chatView);
  shellElement.appendChild(contactPanel);

  return shellElement;
}
