/* ================================================================= *
 * Sidebar Component - src/components/sidebar.js                     *
 * ================================================================= */

import { store } from '../core/store.js';
import { icons } from './icons.js';

export function renderSidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.style.width = '320px';
  sidebar.style.height = '100%';
  sidebar.style.backgroundColor = 'var(--bg-bone)';
  sidebar.style.borderRight = '1px solid rgba(44, 37, 35, 0.08)';
  sidebar.style.display = 'flex';
  sidebar.style.flexDirection = 'column';
  sidebar.style.boxSizing = 'border-box';

  // Header / Search Area
  const headerArea = document.createElement('div');
  headerArea.style.padding = '16px';
  headerArea.style.borderBottom = '1px solid rgba(44, 37, 35, 0.08)';
  headerArea.style.display = 'flex';
  headerArea.style.alignItems = 'center';
  headerArea.style.boxSizing = 'border-box';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search chats...';
  searchInput.style.width = '100%';
  searchInput.style.height = '36px';
  searchInput.style.padding = '0 12px';
  searchInput.style.backgroundColor = 'var(--surface-sand)';
  searchInput.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  searchInput.style.borderRadius = '9999px';
  searchInput.style.outline = 'none';
  searchInput.style.fontFamily = 'inherit';
  searchInput.style.fontSize = '14px';
  searchInput.style.color = 'var(--text-espresso)';
  searchInput.style.boxSizing = 'border-box';

  headerArea.appendChild(searchInput);
  sidebar.appendChild(headerArea);

  // Contact List Area
  const contactList = document.createElement('div');
  contactList.className = 'contact-list';
  contactList.style.flex = '1';
  contactList.style.overflowY = 'auto';
  contactList.style.padding = '8px';
  contactList.style.display = 'flex';
  contactList.style.flexDirection = 'column';
  contactList.style.gap = '4px';
  contactList.style.boxSizing = 'border-box';

  function updateContacts() {
    contactList.innerHTML = '';
    const state = store.getState();
    const contacts = state.contacts || [];
    const activeContact = state.activeContact;

    contacts.forEach(contact => {
      const item = document.createElement('div');
      const isActive = activeContact && activeContact.id === contact.id;

      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '12px';
      item.style.padding = '10px 12px';
      item.style.borderRadius = '12px';
      item.style.cursor = 'pointer';
      item.style.backgroundColor = isActive ? 'var(--surface-sand)' : 'transparent';
      item.style.transition = 'background 0.2s ease';

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
      avatar.style.width = '40px';
      avatar.style.height = '40px';
      avatar.style.borderRadius = '9999px';
      avatar.style.objectFit = 'cover';
      avatar.style.flexShrink = '0';

      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '2px';
      info.style.minWidth = '0';
      info.style.flex = '1';

      const topRow = document.createElement('div');
      topRow.style.display = 'flex';
      topRow.style.justifyContent = 'space-between';
      topRow.style.alignItems = 'center';

      const name = document.createElement('span');
      name.textContent = contact.name;
      name.style.fontSize = '14px';
      name.style.fontWeight = '600';
      name.style.color = 'var(--text-espresso)';
      name.style.whiteSpace = 'nowrap';
      name.style.overflow = 'hidden';
      name.style.textOverflow = 'ellipsis';

      const time = document.createElement('span');
      time.textContent = contact.lastTime || '';
      time.style.fontSize = '12px';
      time.style.color = 'rgba(44, 37, 35, 0.5)';

      topRow.appendChild(name);
      topRow.appendChild(time);

      const lastMsg = document.createElement('span');
      lastMsg.textContent = contact.isTyping ? 'typing...' : (contact.lastMessage || '');
      lastMsg.style.fontSize = '13px';
      lastMsg.style.color = contact.isTyping ? 'var(--accent-sage)' : 'rgba(44, 37, 35, 0.6)';
      lastMsg.style.fontWeight = contact.isTyping ? '600' : '400';
      lastMsg.style.whiteSpace = 'nowrap';
      lastMsg.style.overflow = 'hidden';
      lastMsg.style.textOverflow = 'ellipsis';

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
