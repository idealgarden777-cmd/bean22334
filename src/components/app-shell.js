// src/components/app-shell.js
import { store } from '../core/store.js';

export function createAppShell() {
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  
  const mainContent = document.createElement('div');
  mainContent.className = 'main-content';
  mainContent.textContent = 'Bean Chat Initialized';
  
  shell.appendChild(mainContent);
  return shell;
}

export function mountAppShell(container, appStore = store) {
  if (!container) return;
  container.innerHTML = '';
  container.appendChild(createAppShell());
}
