/* ================================================================= *
 * Sidebar Component - src/components/sidebar.js                     *
 * ================================================================= */

import { store } from '../core/store.js';

export function renderSidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.style.cssText = `
    width: 320px;
    height: 100%;
    background-color: var(--bg-bone);
    border-right: 1px solid rgba(44, 37, 35, 0.08);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;

  const headerArea = document.createElement('div');
  headerArea.style.cssText = `
    padding: 16px;
    border-bottom: 1px solid rgba(44, 37, 35, 0.08);
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
  `;

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search chats...';
  searchInput.style.cssText = `
    width: 100%;
    height: 36px;
    padding: 0 12px;
    background-color: var(--surface-sand);
    border: 1px solid rgba(44, 37, 35, 0.08);
    border-radius: 20px;
    outline: none;
    font-family: inherit;
    font-size: 14px;
    color: var(--text-espresso);
    box-sizing: border-box;
  `;
  headerArea.appendChild(searchInput);
  sidebar.appendChild(headerArea);

  const contactList = document.createElement('div');
  contactList.className = 'contact-list';
  contactList.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-sizing: border-box;
  `;

  function updateContacts() {
    contactList.innerHTML = '';
    const contacts = store.getState().contacts || [];
    const activeContact = store.getState().activeContact;

    contacts.forEach(contact => {
      const item = document.createElement('div');
      const isActive = activeContact && activeContact.id === contact.id;

      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        cursor: pointer;
        background-color: ${isActive ? 'var(--surface-sand)' : 'transparent'};
        transition: background 0.2s ease;
      `;

      item.addEventListener('mouseenter', () => {
        if (!isActive) item.style.backgroundColor = 'rgba(44, 37, 35, 0.04)';
      });
      item.addEventListener('mouseleave', () => {
        if (!isActive) item.style.backgroundColor = 'transparent';
      });

      item.addEventListener('click', () => {
        store.setActiveContact(contact);
      });

      const avatar = document.createElement('img');
      avatar.src = contact.avatar;
      avatar.alt = contact.name;
      avatar.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: var(--radius-avatar);
        object-fit: cover;
        flex-shrink: 0;
      `;

      const info = document.createElement('div');
      info.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      `;

      const topRow = document.createElement('div');
      topRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const name = document.createElement('span');
      name.textContent = contact.name;
      name.style.cssText = `
        font-size: 14px;
        font-weight: 600;
        color: var(--text-espresso);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      const time = document.createElement('span');
      time.textContent = contact.lastTime || '';
      time.style.cssText = `
        font-size: 12px;
        color: rgba(44, 37, 35, 0.5);
      `;

      topRow.appendChild(name);
      topRow.appendChild(time);

      const lastMsg = document.createElement('span');
      lastMsg.textContent = contact.isTyping ? 'typing...' : (contact.lastMessage || '');
      lastMsg.style.cssText = `
        font-size: 13px;
        color: ${contact.isTyping ? 'var(--accent-sage)' : 'rgba(44, 37, 35, 0.6)'};
        font-weight: ${contact.isTyping ? '600' : '400'};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      info.appendChild(topRow);
      info.appendChild(lastMsg);

      item.appendChild(avatar);
      item.appendChild(info);
      contactList.appendChild(item);
    });
  }

  updateContacts();
  sidebar.appendChild(contactList);

  return sidebar;
}
