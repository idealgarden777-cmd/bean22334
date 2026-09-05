// src/components/chat-window.js
import { store } from '../core/store.js';

export function renderChatWindow() {
  const container = document.createElement('div');
  container.className = 'chat-window-pane';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = '100%';
  container.style.background = '#090d16';
  container.style.color = '#f8fafc';

  // Chat Window Header
  const header = document.createElement('div');
  header.style.padding = '16px 20px';
  header.style.borderBottom = '1px solid #334155';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.background = '#0f172a';
  
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: bold;">💬</div>
      <div>
        <div style="font-weight: 600; font-size: 0.95rem;">General Channel</div>
        <div style="font-size: 0.75rem; color: #10b981;">● Online</div>
      </div>
    </div>
  `;
  container.appendChild(header);

  // Messages List Area
  const messagesList = document.createElement('div');
  messagesList.className = 'messages-scroll-area';
  messagesList.style.flex = '1';
  messagesList.style.padding = '20px';
  messagesList.style.overflowY = 'auto';
  messagesList.style.display = 'flex';
  messagesList.style.flexDirection = 'column';
  messagesList.style.gap = '12px';

  // Original welcome/chat message layout
  const sampleMsg = document.createElement('div');
  sampleMsg.style.alignSelf = 'flex-start';
  sampleMsg.style.background = '#1e293b';
  sampleMsg.style.padding = '10px 14px';
  sampleMsg.style.borderRadius = '10px';
  sampleMsg.style.maxWidth = '75%';
  sampleMsg.style.fontSize = '0.9rem';
  sampleMsg.style.border = '1px solid #334155';
  sampleMsg.innerHTML = `
    <div style="color: #94a3b8; font-size: 0.75rem; margin-bottom: 2px;">Bean System</div>
    <div>Welcome back! Your chat architecture is fully restored and running smoothly.</div>
  `;
  messagesList.appendChild(sampleMsg);
  container.appendChild(messagesList);

  // Message Input Form Area
  const inputArea = document.createElement('div');
  inputArea.style.padding = '16px 20px';
  inputArea.style.borderTop = '1px solid #334155';
  inputArea.style.background = '#0f172a';
  inputArea.style.display = 'flex';
  inputArea.style.gap = '10px';

  const inputField = document.createElement('input');
  inputField.type = 'text';
  inputField.placeholder = 'Type your message here...';
  inputField.style.flex = '1';
  inputField.style.padding = '10px 14px';
  inputField.style.background = '#1e293b';
  inputField.style.border = '1px solid #334155';
  inputField.style.borderRadius = '8px';
  inputField.style.color = '#f8fafc';
  inputField.style.outline = 'none';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.style.padding = '10px 20px';
  sendBtn.style.background = '#3b82f6';
  sendBtn.style.border = 'none';
  sendBtn.style.borderRadius = '8px';
  sendBtn.style.color = '#fff';
  sendBtn.style.fontWeight = '600';
  sendBtn.style.cursor = 'pointer';

  inputArea.appendChild(inputField);
  inputArea.appendChild(sendBtn);
  container.appendChild(inputArea);

  return container;
}
