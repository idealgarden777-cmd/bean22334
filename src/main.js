/* ================================================================= *
 * Main Entry Point - src/main.js                                    *
 * ================================================================= */

import { createAppShell } from './components/app-shell.js';

document.addEventListener('DOMContentLoaded', () => {
  const appRoot = document.getElementById('app');
  if (appRoot) {
    appRoot.appendChild(createAppShell());
  }
});
