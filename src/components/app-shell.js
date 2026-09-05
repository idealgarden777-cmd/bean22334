// src/components/app-shell.js
import { store } from '../core/store.js';
import { renderChatList } from './chat-list.js';

export function createAppShell() {
  const shell = document.createElement('div');
  shell.className = 'app-shell-container';
  shell.style.display = 'flex';
  shell.style.height = '100vh';
  shell.style.width = '100vw';
  shell.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  shell.style.background = '#0f172a';
  shell.style.color = '#f8fafc';

  // Sidebar / Chat List Area
  const sidebar = document.createElement('div');
  sidebar.className = 'app-sidebar';
  sidebar.style.width = '320px';
  sidebar.style.borderRight = '1px solid #334155';
  sidebar.style.display = 'flex';
  sidebar.style.flexDirection = 'column';
  
  const sidebarHeader = document.createElement('div');
  sidebarHeader.style.padding = '20px';
  sidebarHeader.style.fontSize = '1.25rem';
  sidebarHeader.style.fontWeight = 'bold';
  sidebarHeader.style.borderBottom = '1px solid #334155';
  sidebarHeader.textContent = 'BEAN CHAT';
  sidebar.appendChild(sidebarHeader);

  // Mount the real chat list component here
  const chatListElement = renderChatList();
  sidebar.appendChild(chatListElement);

  // Main Chat Window Area
  const chatMain = document.createElement('div');
  chatMain.className = 'app-main-chat';
  chatMain.style.flex = '1';
  chatMain.style.display = 'flex';
  chatMain.style.flexDirection = 'column';
  chatMain.style.background = '#090d16';

  const chatHeader = document.createElement('div');
  chatHeader.style.padding = '20px';
  chatHeader.style.borderBottom = '1px solid #334155';
  chatHeader.style.fontSize = '1.1rem';
  chatHeader.style.fontWeight = '600';
  chatHeader.textContent = 'Active Conversation';
  chatMain.appendChild(chatHeader);

  const messagesArea = document.createElement('div');
  messagesArea.style.flex = '1';
  messagesArea.style.padding = '20px';
  messagesArea.style.overflowY = 'auto';
  messagesArea.innerHTML = `<div style="color: #64748b; text-align: center; margin-top: 40px;">Select a conversation from the sidebar to start messaging.</div>`;
  chatMain.appendChild(messagesArea);

  // Append both to shell
  shell.appendChild(sidebar);
  shell.appendChild(chatMain);

  return shell;
}

export function mountAppShell(container, appStore = store) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(createAppShell());
}
