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
  header.style.padding = '20px 16px 12px';
  header.style.borderBottom = '1px solid rgba(44, 37, 35, 0.08)';

  const titleRow = document.createElement('div');
  titleRow.style.display = 'flex';
  titleRow.style.justifyContent = 'space-between';
  titleRow.style.alignItems = 'center';
  titleRow.style.marginBottom = '12px';

  const title = document.createElement('h2');
  title.textContent = 'Chats';
  title.style.fontSize = '18px';
  title.style.fontWeight = '600';
  title.style.color = 'var(--text-espresso)';
  title.style.margin = '0';
  titleRow.appendChild(title);
  header.appendChild(titleRow);

  // Search Bar Container
  const searchContainer = document.createElement('div');
  searchContainer.style.position = 'relative';
  searchContainer.style.display = 'flex';
  searchContainer.style.alignItems = 'center';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search or start new chat';
  searchInput.style.width = '100%';
  searchInput.style.padding = '8px 12px 8px 34px';
  searchInput.style.backgroundColor = 'var(--surface-sand)';
  searchInput.style.border = '1px solid rgba(44, 37, 35, 0.06)';
  searchInput.style.borderRadius = '10px';
  searchInput.style.outline = 'none';
  searchInput.style.fontSize = '13px';
  searchInput.style.color = 'var(--text-espresso)';
  searchInput.style.fontFamily = 'inherit';

  // Search Icon SVG inside input
  const searchIconWrapper = document.createElement('div');
  searchIconWrapper.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(44, 37, 35, 0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  searchIconWrapper.style.position = 'absolute';
  searchIconWrapper.style.left = '10px';
  searchIconWrapper.style.display = 'flex';
  searchIconWrapper.style.alignItems = 'center';
  searchIconWrapper.style.pointerEvents = 'none';

  searchContainer.appendChild(searchIconWrapper);
  searchContainer.appendChild(searchInput);
  header.appendChild(searchContainer);
  sidebar.appendChild(header);

  const contactList = document.createElement('div');
  contactList.className = 'chat-list';
  contactList.style.overflowY = 'auto';
  contactList.style.padding = '16px';
  contactList.style.display = 'flex';
  contactList.style.flexDirection = 'column';
  contactList.style.gap = '8px';

  let searchQuery = '';

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderContacts();
  });

  function renderContacts() {
    contactList.innerHTML = '';
    const filteredContacts = state.contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchQuery)
    );

    if (filteredContacts.length === 0) {
      const noResult = document.createElement('div');
      noResult.textContent = 'No chats found';
      noResult.style.textAlign = 'center';
      noResult.style.color = 'rgba(44, 37, 35, 0.5)';
      noResult.style.fontSize = '13px';
      noResult.style.padding = '20px 0';
      contactList.appendChild(noResult);
      return;
    }

    filteredContacts.forEach(contact => {
      const item = document.createElement('div');
      item.className = 'chat-list-item';
      if (contact.id === state.activeContactId) {
        item.classList.add('active');
        item.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
      }

      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '12px';
      item.style.padding = '10px 12px';
      item.style.borderRadius = '10px';
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
      avatar.style.borderRadius = '9999px';
      avatar.style.objectFit = 'cover';

      const info = document.createElement('div');
      info.style.flex = '1';
      info.style.overflow = 'hidden';

      const name = document.createElement('div');
      name.textContent = contact.name;
      name.style.fontWeight = '600';
      name.style.fontSize = '14px';
      name.style.color = 'var(--text-espresso)';

      const status = document.createElement('div');
      status.textContent = contact.status;
      status.style.fontSize = '12px';
      status.style.color = 'rgba(44, 37, 35, 0.6)';
      status.style.whiteSpace = 'nowrap';
      status.style.overflow = 'hidden';
      status.style.textOverflow = 'ellipsis';

      info.appendChild(name);
      info.appendChild(status);

      item.appendChild(avatar);
      item.appendChild(info);
      contactList.appendChild(item);
    });
  }

  renderContacts();
  sidebar.appendChild(contactList);
  return sidebar;
}
