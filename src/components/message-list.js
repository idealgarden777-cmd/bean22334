// src/components/message-list.js

/**
 * Escapes HTML characters to prevent XSS attacks.
 * @param {string} str - The raw string to escape.
 * @returns {string} The safely escaped string.
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, (tag) => {
    const chars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    return chars[tag] || tag;
  });
}

/**
 * Renders the message list container and all chat bubbles.
 * @param {Array} messages - Array of message objects.
 * @param {Object} currentUser - The current user object for alignment.
 * @returns {HTMLElement} The message list DOM container.
 */
export function renderMessageList(messages = [], currentUser = {}) {
  const container = document.createElement('div');
  container.className = 'message-list';

  // Defensive check: Ensures 'messages' is always treated as an array
  const safeMessages = Array.isArray(messages) ? messages : [];

  // Empty state handling
  if (safeMessages.length === 0) {
    container.innerHTML = '<div class="empty-messages">No messages yet.</div>';
    return container;
  }

  // Render each message bubble safely
  safeMessages.forEach((msg) => {
    // Fallbacks to avoid undefined errors if data is incomplete
    const senderId = msg.senderId || '';
    const text = msg.text || '';
    const timestamp = msg.timestamp || '';
    const currentUserId = currentUser.id || '';

    const isUser = senderId === currentUserId;
    
    const msgEl = document.createElement('div');
    msgEl.className = `message-bubble ${isUser ? 'outgoing' : 'incoming'}`;
    
    msgEl.innerHTML = `
      <div class="message-text">${escapeHTML(text)}</div>
      <span class="message-time">${escapeHTML(timestamp)}</span>
    `;

    container.appendChild(msgEl);
  });

  return container;
}
