// src/components/app-shell.js
import { store } from '../core/store.js';

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

  const chatListContainer = document.createElement('div');
  chatListContainer.style.flex = '1';
  chatListContainer.style.overflowY = 'auto';
  chatListContainer.style.padding = '10px';
  
  // Dummy conversation list item
  const sampleItem = document.createElement('div');
  sampleItem.style.padding = '12px 16px';
  sampleItem.style.marginBottom = '8px';
  sampleItem.style.background = '#1e293b';
  sampleItem.style.borderRadius = '8px';
  sampleItem.style.cursor = 'pointer';
  sampleItem.innerHTML = `<div style="font-weight: 600;">General Channel</div><div style="font-size: 0.85rem; color: #94a3b8;">Tap to chat...</div>`;
  chatListContainer.appendChild(sampleItem);
  
  sidebar.appendChild(chatListContainer);

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
  messagesArea.innerHTML = `<div style="color: #64748b; text-align: center; margin-top: 40px;">Welcome to Bean Chat. Select a conversation to start messaging.</div>`;
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
