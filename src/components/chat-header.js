/* ================================================================= *
 * Chat Header Component - src/components/chat-header.js             *
 * ================================================================= */

import { store } from '../core/store.js';
import { icons } from './icons.js';

export function renderChatHeader(activeContact) {
  const header = document.createElement('div');
  header.className = 'chat-header';
  header.style.cssText = `
    height: 72px;
    background-color: var(--surface-sand);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid rgba(44, 37, 35, 0.08);
    box-sizing: border-box;
  `;

  if (!activeContact) return header;

  const profileContainer = document.createElement('div');
  profileContainer.style.cssText = 'display: flex; align-items: center; gap: 12px;';

  // Dynamic responsive back button handler with resize tracking
  const handleResize = () => {
    const existingBackBtn = profileContainer.querySelector('.mobile-back-btn');
    if (window.innerWidth <= 768 && !existingBackBtn) {
      const backBtn = createActionButton(icons.arrowLeft);
      backBtn.className = 'mobile-back-btn';
      backBtn.style.marginRight = '-4px';
      backBtn.addEventListener('click', () => store.setActiveContact(null));
      profileContainer.prepend(backBtn);
    } else if (window.innerWidth > 768 && existingBackBtn) {
      existingBackBtn.remove();
    }
  };

  window.addEventListener('resize', handleResize);
  handleResize();

  const avatar = document.createElement('img');
  avatar.src = activeContact.avatar;
  avatar.alt = activeContact.name;
  avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 9999px; object-fit: cover;';

  const details = document.createElement('div');
  const name = document.createElement('h3');
  name.textContent = activeContact.name;
  name.style.cssText = 'font-size: 16px; font-weight: 600; color: var(--text-espresso); margin: 0;';

  const status = document.createElement('span');
  status.textContent = activeContact.isTyping ? 'typing...' : activeContact.status;
  status.style.cssText = `
    font-size: 12px;
    color: ${activeContact.isTyping ? 'var(--accent-sage)' : 'rgba(44, 37, 35, 0.6)'};
    font-weight: ${activeContact.isTyping ? '600' : '400'};
    transition: color 0.2s ease;
  `;

  details.appendChild(name);
  details.appendChild(status);
  profileContainer.appendChild(avatar);
  profileContainer.appendChild(details);

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; align-items: center; gap: 8px; position: relative;';

  const callBtn = createActionButton(icons.phone);
  const videoBtn = createActionButton(icons.video);
  const menuBtn = createActionButton(icons.menu);

  const dropdown = document.createElement('div');
  dropdown.className = 'chat-dropdown';
  dropdown.style.cssText = `
    display: none;
    position: absolute;
    top: 44px;
    right: 0;
    width: 160px;
    background-color: var(--surface-sand);
    border: 1px solid rgba(44, 37, 35, 0.08);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(44, 37, 35, 0.08);
    z-index: 100;
    padding: 6px;
  `;

  ['View Profile', 'Clear Chat', 'Block Contact'].forEach(text => {
    const item = document.createElement('div');
    item.textContent = text;
    item.style.cssText = `
      padding: 8px 12px;
      font-size: 13px;
      border-radius: 6px;
      cursor: pointer;
      color: ${text === 'Block Contact' ? '#C94A4A' : 'var(--text-espresso)'};
      transition: background 0.2s ease;
    `;
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = text === 'Block Contact' ? 'rgba(201, 74, 74, 0.08)' : 'rgba(44, 37, 35, 0.06)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(item);
  });

  const handleDocumentClick = () => {
    dropdown.style.display = 'none';
  };
  document.addEventListener('click', handleDocumentClick);

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
  });

  actions.appendChild(callBtn);
  actions.appendChild(videoBtn);
  actions.appendChild(menuBtn);
  actions.appendChild(dropdown);

  header.appendChild(profileContainer);
  header.appendChild(actions);

  return header;
}

function createActionButton(svgHtml) {
  const btn = document.createElement('button');
  btn.innerHTML = svgHtml;
  btn.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--text-espresso);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  `;
  btn.addEventListener('mouseenter', () => btn.style.backgroundColor = 'rgba(44, 37, 35, 0.06)');
  btn.addEventListener('mouseleave', () => btn.style.backgroundColor = 'transparent');
  return btn;
}
```[cite: 2]

```javascript
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
  headerArea.style.cssText = 'padding: 16px; border-bottom: 1px solid rgba(44, 37, 35, 0.08); box-sizing: border-box;';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search chats...';
  searchInput.style.cssText = `
    width: 100%;
    height: 36px;
    padding: 0 12px;
    background-color: var(--surface-sand);
    border: 1px solid rgba(44, 37, 35, 0.08);
    border-radius: 9999px;
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
  contactList.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;';

  function updateContacts() {
    contactList.innerHTML = '';
    const state = store.getState();
    const contacts = state.contacts || [];
    const activeContact = state.activeContact;

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
      item.addEventListener('click', () => store.setActiveContact(contact));

      const avatar = document.createElement('img');
      avatar.src = contact.avatar;
      avatar.alt = contact.name;
      avatar.style.cssText = 'width: 40px; height: 40px; border-radius: 9999px; object-fit: cover; flex-shrink: 0;';

      const info = document.createElement('div');
      info.style.cssText = 'display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;';

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

      const name = document.createElement('span');
      name.textContent = contact.name;
      name.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-espresso); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

      const time = document.createElement('span');
      time.textContent = contact.lastTime || '';
      time.style.cssText = 'font-size: 12px; color: rgba(44, 37, 35, 0.5);';

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
```[cite: 2]
