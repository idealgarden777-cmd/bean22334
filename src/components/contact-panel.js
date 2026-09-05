// src/components/contact-panel.js
import { store } from '../core/store.js';

export function renderContactPanel() {
  const panel = document.createElement('div');
  panel.className = 'contact-panel';
  panel.style.width = '280px';
  panel.style.borderLeft = '1px solid #334155';
  panel.style.background = '#1e293b';
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.height = '100%';

  // Header
  const header = document.createElement('div');
  header.style.padding = '20px';
  header.style.borderBottom = '1px solid #334155';
  header.style.fontWeight = '600';
  header.style.fontSize = '1.05rem';
  header.textContent = 'Contact Info';
  panel.appendChild(header);

  // Content Body
  const content = document.createElement('div');
  content.style.padding = '20px';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.alignItems = 'center';
  content.style.textAlign = 'center';

  // Avatar placeholder
  const avatar = document.createElement('div');
  avatar.style.width = '80px';
  avatar.style.height = '80px';
  avatar.style.borderRadius = '50%';
  avatar.style.background = '#3b82f6';
  avatar.style.display = 'flex';
  avatar.style.alignItems = 'center';
  avatar.style.justifyNames = 'center';
  avatar.style.fontSize = '2rem';
  avatar.style.color = '#fff';
  avatar.style.marginBottom = '15px';
  avatar.textContent = '👤';
  content.appendChild(avatar);

  const name = document.createElement('div');
  name.style.fontSize = '1.1rem';
  name.style.fontWeight = '600';
  name.style.marginBottom = '5px';
  name.textContent = 'General Channel';
  content.appendChild(name);

  const status = document.createElement('div');
  status.style.fontSize = '0.85rem';
  status.style.color = '#94a3b8';
  status.textContent = 'Active & Secure Connection';
  content.appendChild(status);

  panel.appendChild(content);
  return panel;
}
