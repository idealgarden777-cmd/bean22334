/* ================================================================= *
 * Composer Component - src/components/composer.js                   *
 * ================================================================= */

import { store } from '../core/store.js';
import { icons } from './icons.js';

export function renderComposer() {
  const container = document.createElement('div');
  container.className = 'composer-container';
  container.style.padding = 'var(--spacing-sm) var(--spacing-md) var(--spacing-md)';
  container.style.backgroundColor = 'var(--bg-bone)';

  const composer = document.createElement('form');
  composer.className = 'composer';
  composer.style.display = 'flex';
  composer.style.alignItems = 'center';
  composer.style.backgroundColor = 'var(--surface-sand)';
  composer.style.borderRadius = 'var(--radius-avatar)';
  composer.style.padding = '8px var(--spacing-sm)';
  composer.style.gap = 'var(--spacing-xs)';
  composer.style.border = '1px solid rgba(44, 37, 35, 0.08)';

  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.innerHTML = icons.plus;
  styleButton(attachBtn, 'var(--radius-button)');

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a message...';
  input.style.flex = '1';
  input.style.background = 'transparent';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.style.fontFamily = 'var(--font-family)';
  input.style.fontSize = 'var(--font-size-body)';
  input.style.color = 'var(--text-espresso)';
  input.style.padding = '0 var(--spacing-xs)';

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = icons.send;
  styleButton(sendBtn, 'var(--radius-avatar)');
  sendBtn.style.backgroundColor = 'var(--accent-sage)';
  sendBtn.style.color = '#FFFFFF';

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    store.sendMessage(input.value);
    input.value = '';
  });

  composer.appendChild(attachBtn);
  composer.appendChild(input);
  composer.appendChild(sendBtn);
  container.appendChild(composer);

  return container;
}

function styleButton(btn, radius) {
  btn.style.width = '36px';
  btn.style.height = '36px';
  btn.style.borderRadius = radius;
  btn.style.border = 'none';
  btn.style.background = 'transparent';
  btn.style.color = 'var(--text-espresso)';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
}
