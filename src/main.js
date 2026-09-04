import { renderAppShell } from './components/app-shell.js';

document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    renderAppShell(appContainer);
  }
});
