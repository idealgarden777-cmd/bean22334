// src/main.js
import { mountAppShell } from './components/app-shell.js';
import { store } from './core/store.js';

document.addEventListener('DOMContentLoaded', () => {
  // Find the root element in index.html
  let root = document.getElementById('app');
  
  // If #app doesn't exist, create it automatically so the screen is never blank
  if (!root) {
    root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
  }

  // Ensure body styling is clean for full-screen UI
  document.body.style.margin = '0';
  document.body.style.padding = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#0f172a';

  // Mount the app shell
  mountAppShell(root, store);
});
