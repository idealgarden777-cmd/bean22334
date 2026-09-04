/* ================================================================= *
 * Main Entry Point - src/main.js                                    *
 * ================================================================= */

import { store } from './core/store.js';
import { renderAppShell } from './components/app-shell.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (!root) return;

  const appShell = renderAppShell();
  root.appendChild(appShell);

  store.subscribe(() => {
    if (appShell.updateShell) {
      appShell.updateShell();
    }
  });
});
```[cite: 1]
