/* =================================================================
   Sidebar Component - Navigation & Chat List
   ================================================================ */

import { store } from '../core/store.js';

export function renderSidebar(container) {
  const state = store.getState();
  const query = state.searchQuery.toLowerCase();

  const filteredContacts = state.contacts.filter(contact =>
    contact.name.toLowerCase().includes(query)
  );

  container.innerHTML = `
    <div class="sidebar-container">
      <div class="sidebar-header">
        <div class="user-profile-info">
          <img src="${state.currentUser.avatar}" alt="${state.currentUser.name}" class="user-avatar" />
          <span class="user-name">${state.currentUser.name}</span>
        </div>
        <button class="panel-toggle-btn" id="togglePanelBtn" title="Toggle Info Panel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10H3M21 6H3M21 14H3M21 18H3"/>
          </svg>
        </button>
      </div>

      <div class="sidebar-search">
        <div class="search-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="searchInput" placeholder="Search chats..." value="${state.searchQuery}" />
        </div>
      </div>

      <div class="chat-list">
        ${filteredContacts.map(contact => `
          <div class="chat-list-item ${contact.id === state.activeContactId ? 'active' : ''}" data-id="${contact.id}">
            <div class="avatar-container">
              <img src="${contact.avatar}" alt="${contact.name}" class="contact-avatar" />
              <span class="status-indicator ${contact.status.toLowerCase().includes('online') ? 'online' : ''}"></span>
            </div>
            <div class="contact-details">
              <div class="contact-header-row">
                <span class="contact-name">${contact.name}</span>
                <span class="contact-time">${contact.lastSeen}</span>
              </div>
              <div class="contact-preview-row">
                <span class="contact-status-text">${contact.status}</span>
                ${contact.unreadCount > 0 ? `<span class="unread-badge">${contact.unreadCount}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Event Listeners
  const searchInput = container.querySelector('#searchInput');
  searchInput.addEventListener('input', (e) => {
    store.setSearchQuery(e.target.value);
  });

  const toggleBtn = container.querySelector('#togglePanelBtn');
  toggleBtn.addEventListener('click', () => {
    store.toggleContactPanel();
  });

  const items = container.querySelectorAll('.chat-list-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      const contactId = item.getAttribute('data-id');
      store.setActiveContact(contactId);
    });
  });
}

// Sidebar specific styles aligning with typography and spacing design rules
const sidebarStyles = document.createElement('style');
sidebarStyles.textContent = `
  .sidebar-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--space-2);
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--color-border);
  }

  .user-profile-info {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .user-avatar, .contact-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-avatar);
    object-fit: cover;
  }

  .user-name, .contact-name {
    font-size: var(--font-size-base); /* 16px main headings and chat names[cite: 1] */
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
  }

  .panel-toggle-btn {
    padding: 8px;
    border-radius: var(--radius-button);
    color: var(--color-muted);
    transition: var(--transition-smooth);
  }

  .panel-toggle-btn:hover {
    background-color: var(--color-surface);
    color: var(--color-text-primary);
  }

  .sidebar-search {
    margin-bottom: var(--space-2);
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    background-color: var(--color-surface);
    padding: 8px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid transparent;
    transition: var(--transition-smooth);
  }

  .search-input-wrapper:focus-within {
    border-color: var(--color-border-focus);
  }

  .search-input-wrapper input {
    width: 100%;
    font-size: var(--font-size-sm);
  }

  .chat-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .chat-list-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 10px 12px;
    border-radius: var(--radius-button);
    cursor: pointer;
    transition: var(--transition-smooth);
  }

  .chat-list-item:hover {
    background-color: var(--color-surface);
  }

  .chat-list-item.active {
    background-color: var(--color-surface);
    border-left: 3px solid var(--color-accent);
  }

  .avatar-container {
    position: relative;
  }

  .status-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    background-color: #ccc;
    border: 2px solid var(--color-bg);
    border-radius: var(--radius-avatar);
  }

  .status-indicator.online {
    background-color: #4CAF50;
  }

  .contact-details {
    flex: 1;
    min-width: 0;
  }

  .contact-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .contact-time {
    font-size: var(--font-size-xs); /* 12px timestamps[cite: 1] */
    color: var(--color-muted);
  }

  .contact-preview-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 2px;
  }

  .contact-status-text {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .unread-badge {
    background-color: var(--color-accent);
    color: var(--color-white);
    font-size: 10px;
    padding: 2px 6px;
    border-radius: var(--radius-pill);
    font-weight: var(--font-weight-semibold);
  }
`;
document.head.appendChild(sidebarStyles);
