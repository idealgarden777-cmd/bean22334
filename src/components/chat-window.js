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

  // Helper function to append a message bubble
  const appendMessage = (text, sender = 'You') => {
    const msgBubble = document.createElement('div');
    msgBubble.style.alignSelf = sender === 'You' ? 'flex-end' : 'flex-start';
    msgBubble.style.background = sender === 'You' ? '#3b82f6' : '#1e293b';
    msgBubble.style.color = '#fff';
    msgBubble.style.padding = '10px 14px';
    msgBubble.style.borderRadius = '10px';
    msgBubble.style.maxWidth = '75%';
    msgBubble.style.fontSize = '0.9rem';
    msgBubble.style.border = sender === 'You' ? 'none' : '1px solid #334155';
    
    msgBubble.innerHTML = `
      <div style="font-size: 0.7rem; opacity: 0.8; margin-bottom: 2px;">${sender}</div>
      <div>${text}</div>
    `;
    messagesList.appendChild(msgBubble);
    messagesList.scrollTop = messagesList.scrollHeight;
  };

  // Initial welcome message
  appendMessage('Welcome back! Your chat architecture is fully restored and running smoothly.', 'Bean System');
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

  // Handle send action
  const handleSend = () => {
    const text = inputField.value.trim();
    if (!text) return;
    
    appendMessage(text, 'You');
    inputField.value = '';

    // If store has message dispatch, invoke it safely
    if (typeof store.sendMessage === 'function') {
      store.sendMessage(text);
    }
  };

  sendBtn.addEventListener('click', handleSend);
  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  inputArea.appendChild(inputField);
  inputArea.appendChild(sendBtn);
  container.appendChild(inputArea);

  return container;
}
