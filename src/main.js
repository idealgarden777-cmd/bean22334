// src/main.js
import { mountAppShell } from './components/app-shell.js';
import { store } from './core/store.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    mountAppShell(root, store);
  } else {
    console.error("Root element #app not found!");
  }
});
