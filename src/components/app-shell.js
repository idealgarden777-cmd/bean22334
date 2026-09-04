/* ================================================================= *
 * App Shell - src/components/app-shell.js                           *
 * ================================================================= */

import { store } from '../core/store.js';
import { renderSidebar } from './sidebar.js';
import { renderChatView } from './chat-view.js';

export function createAppShell() {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const updateView = (state) => {
    shell.innerHTML = '';
    shell.appendChild(renderSidebar(state));
    shell.appendChild(renderChatView(state));
  };

  store.subscribe(updateView);
  updateView(store.getState());

  return shell;
}
