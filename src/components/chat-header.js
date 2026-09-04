/* ================================================================= *
 * Chat Header Component - src/components/chat-header.js             *
 * ================================================================= */

import { icons } from './icons.js';

export function renderChatHeader(activeContact) {
  const header = document.createElement('div');
  header.className = 'chat-header';
  header.style.height = '72px'; // Fixed height layout specification[cite: 1]
  header.style.backgroundColor = 'var(--surface-sand)'; // Soft Sand surface specification[cite: 1]
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '0 16px'; // 8px grid consistent spacing[cite: 1]
  header.style.borderBottom = '1px solid rgba(44, 37, 35, 0.08)';

  if (!activeContact) {
    return header;
  }

  const profileContainer = document.createElement('div');
  profileContainer.style.display = 'flex';
  profileContainer.style.alignItems = 'center';
  profileContainer.style.gap = '12px';

  const avatar = document.createElement('img');
  avatar.src = activeContact.avatar;
  avatar.alt = activeContact.name;
  avatar.style.width = '40px';
  avatar.style.height = '40px';
  avatar.style.borderRadius = '9999px'; // Profile avatars specification[cite: 1]
  avatar.style.objectFit = 'cover';

  const details = document.createElement('div');
  
  const name = document.createElement('h3');
  name.textContent = activeContact.name;
  name.style.fontSize = '16px'; // Main headings specification[cite: 1]
  name.style.fontWeight = '600';
  name.style.color = 'var(--text-espresso)';

  const status = document.createElement('span');
  status.textContent = activeContact.status;
  status.style.fontSize = '12px'; // Status badges specification[cite: 1]
  status.style.color = 'rgba(44, 37, 35, 0.6)';

  details.appendChild(name);
  details.appendChild(status);

  profileContainer.appendChild(avatar);
  profileContainer.appendChild(details);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = '8px'; // 8px grid spacing[cite: 1]

  const callBtn = createActionButton(icons.phone);
  const videoBtn = createActionButton(icons.video);
  const menuBtn = createActionButton(icons.menu);

  actions.appendChild(callBtn);
  actions.appendChild(videoBtn);
  actions.appendChild(menuBtn);

  header.appendChild(profileContainer);
  header.appendChild(actions);

  return header;
}

function createActionButton(svgHtml) {
  const btn = document.createElement('button');
  btn.innerHTML = svgHtml;
  btn.style.width = '36px';
  btn.style.height = '36px';
  btn.style.borderRadius = '10px'; // Border radius specification[cite: 1]
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
