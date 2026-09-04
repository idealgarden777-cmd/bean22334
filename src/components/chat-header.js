/* ================================================================= *
 * Chat Header Component - src/components/chat-header.js             *
 * ================================================================= */

export function renderChatHeader(activeContact) {
  const header = document.createElement('div');
  header.className = 'chat-header';
  header.style.height = '72px';
  header.style.backgroundColor = 'var(--surface-sand)';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '0 var(--spacing-md)';
  header.style.borderBottom = '1px solid rgba(44, 37, 35, 0.08)';

  if (!activeContact) {
    return header;
  }

  // Participant profile alignment[cite: 3]
  const profileContainer = document.createElement('div');
  profileContainer.style.display = 'flex';
  profileContainer.style.alignItems = 'center';
  profileContainer.style.gap = 'var(--spacing-sm)';

  const avatar = document.createElement('img');
  avatar.src = activeContact.avatar;
  avatar.alt = activeContact.name;
  avatar.style.width = '40px';
  avatar.style.height = '40px';
  avatar.style.borderRadius = 'var(--radius-avatar)';
  avatar.style.objectFit = 'cover';

  const details = document.createElement('div');
  
  const name = document.createElement('h3');
  name.textContent = activeContact.name;
  name.style.fontSize = '16px';
  name.style.fontWeight = '600';
  name.style.color = 'var(--text-espresso)';

  const status = document.createElement('span');
  status.textContent = activeContact.status;
  status.style.fontSize = '12px';
  status.style.color = 'rgba(44, 37, 35, 0.6)';

  details.appendChild(name);
  details.appendChild(status);

  profileContainer.appendChild(avatar);
  profileContainer.appendChild(details);

  // Actions: call buttons, video icon, action menu[cite: 3]
  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.alignItems = 'center';
  actions.style.gap = 'var(--spacing-xs)';

  const callBtn = createActionButton('📞');
  const videoBtn = createActionButton('🎥');
  const menuBtn = createActionButton('⋮');

  actions.appendChild(callBtn);
  actions.appendChild(videoBtn);
  actions.appendChild(menuBtn);

  header.appendChild(profileContainer);
  header.appendChild(actions);

  return header;
}

function createActionButton(text) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.width = '36px';
  btn.style.height = '36px';
  btn.style.borderRadius = 'var(--radius-button)';
  btn.style.border = 'none';
  btn.style.background = 'transparent';
  btn.style.color = 'var(--text-espresso)';
  btn.style.cursor = 'pointer';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.fontSize = '16px';

  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = 'rgba(44, 37, 35, 0.06)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.backgroundColor = 'transparent';
  });

  return btn;
}
