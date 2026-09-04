/* ================================================================= *
 * Chat Header Component - src/components/chat-header.js             *
 * ================================================================= */

import { store } from '../core/store.js';
import { icons } from './icons.js';

export function renderChatHeader(activeContact) {
  const header = document.createElement('div');
  header.className = 'chat-header';
  header.style.height = '72px';
  header.style.backgroundColor = 'var(--surface-sand)';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '0 16px';
  header.style.borderBottom = '1px solid rgba(44, 37, 35, 0.08)';

  if (!activeContact) {
    return header;
  }

  const profileContainer = document.createElement('div');
  profileContainer.style.display = 'flex';
  profileContainer.style.alignItems = 'center';
  profileContainer.style.gap = '12px';

  if (window.innerWidth <= 768) {
    const backBtn = createActionButton(icons.arrowLeft);
    backBtn.style.marginRight = '-4px';
    backBtn.addEventListener('click', () => {
      store.setActiveContact(null);
    });
    profileContainer.appendChild(backBtn);
  }

  const avatar = document.createElement('img');
  avatar.src = activeContact.avatar;
  avatar.alt = activeContact.name;
  avatar.style.width = '40px';
  avatar.style.height = '40px';
  avatar.style.borderRadius = '9999px';
  avatar.style.objectFit = 'cover';

  const details = document.createElement('div');
  
  const name = document.createElement('h3');
  name.textContent = activeContact.name;
  name.style.fontSize = '16px';
  name.style.fontWeight = '600';
  name.style.color = 'var(--text-espresso)';
  name.style.margin = '0';

  const status = document.createElement('span');
  status.textContent = activeContact.status;
  status.style.fontSize = '12px';
  status.style.color = 'rgba(44, 37, 35, 0.6)';

  details.appendChild(name);
  details.appendChild(status);

  profileContainer.appendChild(avatar);
  profileContainer.appendChild(details);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '8px';
  actions.style.position = 'relative'; // Required for dropdown positioning

  const callBtn = createActionButton(icons.phone);
  const videoBtn = createActionButton(icons.video);
  const menuBtn = createActionButton(icons.menu);

  // Dropdown Menu Creation
  const dropdown = document.createElement('div');
  dropdown.className = 'chat-dropdown';
  dropdown.style.display = 'none';
  dropdown.style.position = 'absolute';
  dropdown.style.top = '44px';
  dropdown.style.right = '0';
  dropdown.style.width = '160px';
  dropdown.style.backgroundColor = 'var(--surface-sand)';
  dropdown.style.border = '1px solid rgba(44, 37, 35, 0.08)';
  dropdown.style.borderRadius = '10px';
  dropdown.style.boxShadow = '0 4px 16px rgba(44, 37, 35, 0.08)';
  dropdown.style.zIndex = '100';
  dropdown.style.padding = '6px';

  const options = ['View Profile', 'Clear Chat', 'Block Contact'];
  options.forEach(text => {
    const item = document.createElement('div');
    item.textContent = text;
    item.style.padding = '8px 12px';
    item.style.fontSize = '13px';
    item.style.borderRadius = '6px';
    item.style.cursor = 'pointer';
    item.style.color = text === 'Block Contact' ? '#C94A4A' : 'var(--text-espresso)';
    item.style.transition = 'background 0.2s ease';

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

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    dropdown.style.display = 'none';
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
  btn.style.width = '36px';
  btn.style.height = '36px';
  btn.style.borderRadius = '10px';
  btn.style.border = 'none';
  btn.style.background = 'transparent';
  btn.style.color = 'var(--text-espresso)';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.transition = 'background 0.2s ease';

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'transparent';
  });

  return btn;
}
