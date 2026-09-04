/* ================================================================= *
 * Message List Component - src/components/message-list.js           *
 * ================================================================= */

export function renderMessageList(messages, currentUser) {
  const container = document.createElement('div');
  container.className = 'message-list';
  container.style.flex = '1';
  container.style.overflowY = 'auto';
  container.style.padding = '16px'; // 8px grid rule increment[cite: 1]
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '12px';

  if (!messages || messages.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.textContent = 'No messages yet. Start the conversation!';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(44, 37, 35, 0.5)';
    emptyState.style.marginTop = '40px';
    emptyState.style.fontSize = '14px'; // Body text sizing[cite: 1]
    container.appendChild(emptyState);
    return container;
  }

  messages.forEach(msg => {
    const isOutgoing = msg.senderId === currentUser.id;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
    bubble.style.maxWidth = '65%';
    bubble.style.padding = '10px 14px'; // Custom padded message container specification[cite: 1]
    bubble.style.borderRadius = '12px'; // Border radius measures 10px to 12px for chat bubbles[cite: 1]
    bubble.style.fontSize = '14px'; // Body text and messages are sized at 14px regular[cite: 1]
    bubble.style.lineHeight = '1.4';
    bubble.style.position = 'relative';
    bubble.style.boxShadow = '0 1px 2px rgba(44, 37, 35, 0.04)';

    if (isOutgoing) {
      bubble.style.backgroundColor = 'var(--accent-sage)'; // Muted Sage Green brand accent[cite: 1]
      bubble.style.color = '#FFFFFF';
      bubble.style.alignSelf = 'flex-end';
    } else {
      bubble.style.backgroundColor = 'var(--surface-sand)'; // Soft Sand surface and card elements[cite: 1]
      bubble.style.color = 'var(--text-espresso)'; // Deep Espresso Brown primary text[cite: 1]
      bubble.style.alignSelf = 'flex-start';
    }

    const text = document.createElement('div');
    text.textContent = msg.text;
    bubble.appendChild(text);

    const timestamp = document.createElement('span');
    timestamp.textContent = `${msg.timestamp} ${isOutgoing ? '✓✓' : ''}`; // Delivery check-ticks support[cite: 1]
    timestamp.style.fontSize = '12px'; // Timestamps and status badges use muted 12px sizing[cite: 1]
    timestamp.style.display = 'block';
    timestamp.style.textAlign = 'right';
    timestamp.style.marginTop = '4px';
    timestamp.style.color = isOutgoing ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 37, 35, 0.6)';
    bubble.appendChild(timestamp);

    container.appendChild(bubble);
  });

  return container;
}
