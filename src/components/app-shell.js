// src/components/app-shell.js
import { store } from '../core/store.js';
import { renderChatList } from './chat-list.js';
import { renderChatWindow } from './chat-window.js';
import { renderContactPanel } from './contact-panel.js';

export function createAppShell() {
  const shell = document.createElement('div');
  shell.className = 'app-shell-container';
  shell.style.display = 'flex';
  shell.style.height = '100vh';
  shell.style.width = '100vw';
  shell.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  shell.style.background = '#0f172a';
  shell.style.color = '#f8fafc';
  shell.style.overflow = 'hidden';

  // 1. Sidebar / Chat List Pane
  const sidebar = document.createElement('div');
  sidebar.className = 'app-sidebar';
  sidebar.style.width = '300px';
  sidebar.style.minWidth = '300px';
  sidebar.style.borderRight = '1px solid #334155';
  sidebar.style.display = 'flex';
  sidebar.style.flexDirection = 'column';
  
  const sidebarHeader = document.createElement('div');
  sidebarHeader.style.padding = '16px 20px';
  sidebarHeader.style.fontSize = '1.15rem';
  sidebarHeader.style.fontWeight = 'bold';
  sidebarHeader.style.borderBottom = '1px solid #334155';
  sidebarHeader.style.background = '#0f172a';
  sidebarHeader.textContent = 'BEAN CHAT';
  sidebar.appendChild(sidebarHeader);

  const chatListEl = renderChatList();
  chatListEl.style.flex = '1';
  sidebar.appendChild(chatListEl);

  // 2. Main Chat Window Pane
  const chatMain = document.createElement('div');
  chatMain.className = 'app-main-chat';
  chatMain.style.flex = '1';
  chatMain.style.display = 'flex';
  chatMain.style.flexDirection = 'column';
  chatMain.style.height = '100%';
  
  const chatWindowEl = renderChatWindow();
  chatWindowEl.style.flex = '1';
  chatMain.appendChild(chatWindowEl);

  // 3. Right Contact Panel Pane
  const contactPane = document.createElement('div');
  contactPane.className = 'app-contact-pane';
  contactPane.style.width = '280px';
  contactPane.style.minWidth = '280px';
  contactPane.style.borderLeft = '1px solid #334155';
  contactPane.style.display = 'flex';
  contactPane.style.flexDirection = 'column';
  
  const contactPanelEl = renderContactPanel();
  contactPanelEl.style.flex = '1';
  contactPane.appendChild(contactPanelEl);

  // Append all three sections to the main app shell
  shell.appendChild(sidebar);
  shell.appendChild(chatMain);
  shell.appendChild(contactPane);

  return shell;
}

export function mountAppShell(container, appStore = store) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(createAppShell());
}
