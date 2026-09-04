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
  composer.style.padding = '8px';
  composer.style.gap = 'var(--spacing-xs)';
  composer.style.border = '1px solid rgba(44, 37, 35, 0.08)';

  const attachWrapper = document.createElement('div');
  attachWrapper.style.position = 'relative';
  attachWrapper.style.display = 'flex';

  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.innerHTML = icons.plus;
  styleButton(attachBtn, 'var(--radius-button)');

  const dropup = document.createElement('div');
  dropup.className = 'composer-dropup';
  dropup.style.display = 'none';
  dropup.style.position = 'absolute';
  dropup.style.bottom = '48px';
  dropup.style.left = '0';
  dropup.style.width = '160px';
  dropup.style.backgroundColor = 'var(--surface-sand)';
  dropup.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  dropup.style.borderRadius = '10px';
  dropup.style.boxShadow = '0 -4px 16px rgba(44, 37, 35, 0.08)';
  dropup.style.zIndex = '100';
  dropup.style.padding = '6px';

  const options = ['Photos & Videos', 'Document', 'Audio'];
  options.forEach(text => {
    const item = document.createElement('div');
    item.textContent = text;
    item.style.padding = '8px 12px';
    item.style.fontSize = '13px';
    item.style.borderRadius = '6px';
    item.style.cursor = 'pointer';
    item.style.color = 'var(--text-espresso)';
    item.style.transition = 'background 0.2s ease';

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      dropup.style.display = 'none';
    });

    dropup.appendChild(item);
  });

  attachBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropup.style.display === 'block';
    dropup.style.display = isVisible ? 'none' : 'block';
  });

  document.addEventListener('click', () => {
    dropup.style.display = 'none';
  });

  attachWrapper.appendChild(attachBtn);
  attachWrapper.appendChild(dropup);

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

  // Microphone Button for Voice Notes
  const micBtn = document.createElement('button');
  micBtn.type = 'button';
  micBtn.innerHTML = icons.mic;
  styleButton(micBtn, 'var(--radius-button)');
  micBtn.title = 'Record Voice Note';
  micBtn.addEventListener('click', () => {
    // Voice note recording action placeholder
    console.log('Voice note recording triggered');
  });

  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.innerHTML = icons.send;
  styleButton(sendBtn, '9999px');
  sendBtn.style.backgroundColor = 'var(--accent-sage)';
  sendBtn.style.color = '#FFFFFF';

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim() === '') return;
    store.sendMessage(input.value);
    input.value = '';
  });

  composer.appendChild(attachWrapper);
  composer.appendChild(input);
  composer.appendChild(micBtn);
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
  btn.style.transition = 'background 0.2s ease';

  btn.addEventListener('mouseenter', () => {
    if (btn.style.backgroundColor !== 'var(--accent-sage)') {
      btn.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    }
  });
  btn.addEventListener('mouseleave', () => {
    if (btn.style.backgroundColor !== 'var(--accent-sage)') {
      btn.style.backgroundColor = 'transparent';
    }
  });
}
