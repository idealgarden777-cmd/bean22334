/* ================================================================= *
 * Message List Component - src/components/message-list.js           *
 * ================================================================= */

export function renderMessageList(messages, currentUser) {
  const container = document.createElement('div');
  container.className = 'message-list';
  container.style.flex = '1';
  container.style.overflowY = 'auto';
  container.style.padding = 'var(--spacing-md)';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = 'var(--spacing-sm)';

  if (!messages || messages.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.textContent = 'No messages yet. Start the conversation!';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(44, 37, 35, 0.5)';
    emptyState.style.marginTop = '40px';
    container.appendChild(emptyState);
    return container;
  }

  messages.forEach(msg => {
    const isOutgoing = msg.senderId === currentUser.id;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
    bubble.style.maxWidth = '65%';
    bubble.style.padding = '12px var(--spacing-sm)';
    bubble.style.borderRadius = 'var(--radius-bubble)';
    bubble.style.fontSize = 'var(--font-size-body)';
    bubble.style.position = 'relative';
    bubble.style.boxShadow = '0 1px 2px rgba(44, 37, 35, 0.04)';

    if (isOutgoing) {
      bubble.style.backgroundColor = 'var(--accent-sage)';
      bubble.style.color = '#FFFFFF';
      bubble.style.alignSelf = 'flex-end';
    } else {
      bubble.style.backgroundColor = 'var(--surface-sand)';
      bubble.style.color = 'var(--text-espresso)';
      bubble.style.alignSelf = 'flex-start';
    }

    const text = document.createElement('div');
    text.textContent = msg.text;
    bubble.appendChild(text);

    const timestamp = document.createElement('span');
    timestamp.textContent = `${msg.timestamp} ${isOutgoing ? '✓✓' : ''}`;
    timestamp.style.fontSize = 'var(--font-size-muted)';
    timestamp.style.display = 'block';
    timestamp.style.textAlign = 'right';
    timestamp.style.marginTop = '4px';
    timestamp.style.color = isOutgoing ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 37, 35, 0.6)';
    bubble.appendChild(timestamp);

    container.appendChild(bubble);
  });

  return container;
}
