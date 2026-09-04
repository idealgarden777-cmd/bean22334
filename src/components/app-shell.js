/* ================================================================= *
 * App Shell Component - src/components/app-shell.js                 *
 * ================================================================= */

import { store } from '../core/store.js';
import { renderSidebar } from './sidebar.js';
import { renderChatView } from './chat-view.js';

export function renderAppShell() {
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.style.cssText = `
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: var(--bg-bone);
    font-family: var(--font-family, sans-serif);
    box-sizing: border-box;
  `;

  function updateShell() {
    shell.innerHTML = '';

    const sidebar = renderSidebar();
    const chatView = renderChatView();

    shell.appendChild(sidebar);
    shell.appendChild(chatView);
  }

  updateShell();
  shell.updateShell = updateShell;

  return shell;
}
```[cite: 2]
