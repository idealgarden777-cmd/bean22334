/* ================================================================= *
 * Contact Panel Component - src/components/contact-panel.js         *
 * ================================================================= */

import { store } from '../core/store.js';

export function renderContactPanel() {
  const panel = document.createElement('div');
  panel.className = 'contact-panel';
  panel.style.cssText = `
    width: 320px;
    height: 100%;
    background-color: var(--bg-bone);
    border-left: 1px solid rgba(44, 37, 35, 0.08);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 24px 16px;
    align-items: center;
    text-align: center;
  `;

  const state = store.getState();
  const activeContact = state.activeContact;

  if (!activeContact) {
    return panel;
  }

  const avatar = document.createElement('img');
  avatar.src = activeContact.avatar;
  avatar.alt = activeContact.name;
  avatar.style.cssText = `
    width: 80px;
    height: 80px;
    border-radius: 9999px;
    object-fit: cover;
    margin-bottom: 16px;
  `;

  const name = document.createElement('h3');
  name.textContent = activeContact.name;
  name.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: var(--text-espresso);
    margin: 0 0 4px 0;
  `;

  const status = document.createElement('p');
  status.textContent = activeContact.status || 'Online';
  status.style.cssText = `
    font-size: 13px;
    color: rgba(44, 37, 35, 0.6);
    margin: 0 0 24px 0;
  `;

  panel.appendChild(avatar);
  panel.appendChild(name);
  panel.appendChild(status);

  return panel;
}
