/* ================================================================= *
 * Main Entry Point - src/main.js                                    *
 * ================================================================= */

import { createAppShell } from './components/app-shell.js';

document.addEventListener('DOMContentLoaded', () => {
  const appElement = document.getElementById('app');
  if (appElement) {
    const shell = createAppShell();
    appElement.appendChild(shell);
  }
});
