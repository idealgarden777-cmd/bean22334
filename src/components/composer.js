/* ================================================================= *
 * Composer Component - src/components/composer.js                   *
 * ================================================================= */

import { store } from '../core/store.js';
import { icons } from './icons.js';

export function renderComposer() {
  const composer = document.createElement('div');
  composer.className = 'chat-composer';
  composer.style.cssText = `
    display: flex;
    align-items: flex-end;
    padding: 12px 16px;
    background-color: var(--surface-sand);
    border-top: 1px solid rgba(44, 37, 35, 0.08);
    gap: 8px;
    box-sizing: border-box;
    position: relative;
  `;

  const inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = `
    flex: 1;
    display: flex;
    align-items: center;
    background-color: var(--bg-bone);
    border: 1px solid rgba(44, 37, 35, 0.08);
    border-radius: 20px;
    padding: 8px 12px;
    box-sizing: border-box;
  `;

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Type a message...';
  textarea.rows = 1;
  textarea.style.cssText = `
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-family: inherit;
    font-size: 14px;
    color: var(--text-espresso);
    resize: none;
    max-height: 120px;
    line-height: 20px;
  `;

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  });

  inputWrapper.appendChild(textarea);

  const sendBtn = document.createElement('button');
  sendBtn.innerHTML = icons.send || '➔';
  sendBtn.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 9999px;
    border: none;
    background-color: var(--accent-sage);
    color: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  `;

  sendBtn.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (text) {
      store.addMessage({ sender: 'user', text });
      textarea.value = '';
      textarea.style.height = 'auto';
    }
  });

  composer.appendChild(inputWrapper);
  composer.appendChild(sendBtn);

  return composer;
}
