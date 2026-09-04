/* ================================================================= *
 * Sidebar Component - src/components/sidebar.js                     *
 * ================================================================= */

import { store } from '../core/store.js';

export function renderSidebar(state) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.style.width = '320px';
  sidebar.style.backgroundColor = 'var(--bg-bone)';
  sidebar.style.borderRight = '1px solid rgba(44, 37, 35, 0.08)';
  sidebar.style.display = 'flex';
  sidebar.style.flexDirection = 'column';
  sidebar.style.height = '100%';

  const header = document.createElement('div');
  header.className = 'sidebar-header';
  header.style.padding = '24px 16px 16px'; // 8px grid compliant[cite: 1]
  header.style.borderBottom = '1px solid rgba(44, 37, 35, 0.08)';

  const title = document.createElement('h2');
  title.textContent = 'Chats';
  title.style.fontSize = '16px'; // Main heading specification[cite: 1]
  title.style.fontWeight = '600';
  title.style.color = 'var(--text-espresso)';
  header.appendChild(title);
  sidebar.appendChild(header);

  const contactList = document.createElement('div');
  contactList.className = 'chat-list';
  contactList.style.overflowY = 'auto';
  contactList.style.padding = '16px'; // 8px grid spacing[cite: 1]
  contactList.style.display = 'flex';
  contactList.style.flexDirection = 'column';
  contactList.style.gap = '8px'; // 8px grid spacing[cite: 1]

  state.contacts.forEach(contact => {
    const item = document.createElement('div');
    item.className = 'chat-list-item';
    if (contact.id === state.activeContactId) {
      item.classList.add('active');
      item.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
    }

    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '12px';
    item.style.padding = '12px';
    item.style.borderRadius = '10px'; // Border radius specification[cite: 1]
    item.style.cursor = 'pointer';
    item.style.transition = 'background 0.2s ease';

    item.addEventListener('mouseenter', () => {
      if (contact.id !== state.activeContactId) {
        item.style.backgroundColor = 'rgba(44, 37, 35, 0.03)';
      }
    });
    item.addEventListener('mouseleave', () => {
      if (contact.id !== state.activeContactId) {
        item.style.backgroundColor = 'transparent';
      }
    });

    item.addEventListener('click', () => {
      store.setActiveContact(contact.id);
    });

    const avatar = document.createElement('img');
    avatar.src = contact.avatar;
    avatar.alt = contact.name;
    avatar.className = 'avatar';
    avatar.style.width = '40px';
    avatar.style.height = '40px';
    avatar.style.borderRadius = '9999px'; // Profile avatars specification[cite: 1]
    avatar.style.objectFit = 'cover';

    const info = document.createElement('div');
    info.style.flex = '1';
    info.style.overflow = 'hidden';

    const name = document.createElement('div');
    name.textContent = contact.name;
    name.style.fontWeight = '600';
    name.style.fontSize = '16px'; // Chat names specification[cite: 1]
    name.style.color = 'var(--text-espresso)';

    const status = document.createElement('div');
    status.textContent = contact.status;
    status.style.fontSize = '12px'; // Status badges specification[cite: 1]
    status.style.color = 'rgba(44, 37, 35, 0.6)';

    info.appendChild(name);
    info.appendChild(status);

    item.appendChild(avatar);
    item.appendChild(info);
    contactList.appendChild(item);
  });

  sidebar.appendChild(contactList);
  return sidebar;
}
