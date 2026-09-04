/* ================================================================= *
 * App Shell Component - src/components/app-shell.js                 *
 * ================================================================= */

import { store } from '../core/store.js';
import { renderSidebar } from './sidebar.js';
import { renderChatView } from './chat-view.js';

export function createAppShell() {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const update = () => {
    shell.innerHTML = '';
    const state = store.getState();

    // Handle responsive state class for mobile slide transition
    if (state.activeContactId && window.innerWidth <= 768) {
      shell.classList.add('mobile-chat-open');
    } else {
      shell.classList.remove('mobile-chat-open');
    }

    const sidebar = renderSidebar(state);
    const chatView = renderChatView(state);

    shell.appendChild(sidebar);
    shell.appendChild(chatView);
  };

  store.subscribe(update);

  window.addEventListener('resize', () => {
    const state = store.getState();
    if (window.innerWidth > 768) {
      shell.classList.remove('mobile-chat-open');
    } else if (state.activeContactId) {
      shell.classList.add('mobile-chat-open');
    }
  });

  update();
  return shell;
}
