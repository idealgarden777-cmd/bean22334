/* ================================================================= *
 * Message List Component - src/components/message-list.js           *
 * ================================================================= */

export function renderMessageList(messages, currentUser) {
  const container = document.createElement('div');
  container.className = 'message-list';
  container.style.flex = '1';
  container.style.overflowY = 'auto';
  container.style.padding = '16px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '4px';

  if (!messages || messages.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.textContent = 'No messages yet. Start the conversation!';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(44, 37, 35, 0.5)';
    emptyState.style.marginTop = '40px';
    emptyState.style.fontSize = '14px';
    container.appendChild(emptyState);
    return container;
  }

  messages.forEach((msg, index) => {
    const isOutgoing = msg.senderId === currentUser.id;

    const prevMsg = messages[index - 1];
    const nextMsg = messages[index + 1];
    
    const isSameAsPrev = prevMsg && prevMsg.senderId === msg.senderId;
    const isSameAsNext = nextMsg && nextMsg.senderId === msg.senderId;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
    bubble.style.maxWidth = '60%';
    bubble.style.padding = '6px 12px';
    bubble.style.fontSize = '14px';
    bubble.style.lineHeight = '1.35';
    bubble.style.position = 'relative';
    bubble.style.wordBreak = 'break-word';

    if (isOutgoing) {
      bubble.style.backgroundColor = 'var(--accent-sage)';
      bubble.style.color = '#FFFFFF';
      bubble.style.alignSelf = 'flex-end';

      let tl = '18px', tr = '18px', br = '18px', bl = '18px';
      if (!isSameAsPrev && isSameAsNext) {
        tl = '18px'; tr = '18px'; br = '4px'; bl = '18px';
      } else if (isSameAsPrev && isSameAsNext) {
        tl = '18px'; tr = '4px'; br = '4px'; bl = '18px';
      } else if (isSameAsPrev && !isSameAsNext) {
        tl = '18px'; tr = '4px'; br = '18px'; bl = '18px';
      } else {
        tl = '18px'; tr = '18px'; br = '4px'; bl = '18px';
      }
      bubble.style.borderRadius = `${tl} ${tr} ${br} ${bl}`;
    } else {
      bubble.style.backgroundColor = 'var(--surface-sand)';
      bubble.style.color = 'var(--text-espresso)';
      bubble.style.alignSelf = 'flex-start';

      let tl = '18px', tr = '18px', br = '18px', bl = '18px';
      if (!isSameAsPrev && isSameAsNext) {
        tl = '18px'; tr = '18px'; bl = '4px'; br = '18px';
      } else if (isSameAsPrev && isSameAsNext) {
        tl = '4px'; tr = '18px'; bl = '4px'; br = '18px';
      } else if (isSameAsPrev && !isSameAsNext) {
        tl = '4px'; tr = '18px'; bl = '18px'; br = '18px';
      } else {
        tl = '18px'; tr = '18px'; bl = '4px'; br = '18px';
      }
      bubble.style.borderRadius = `${tl} ${tr} ${br} ${bl}`;
    }

    const text = document.createElement('div');
    text.textContent = msg.text;
    bubble.appendChild(text);

    const timestamp = document.createElement('span');
    timestamp.textContent = `${msg.timestamp} ${isOutgoing ? '✓✓' : ''}`;
    timestamp.style.fontSize = '11px';
    timestamp.style.display = 'block';
    timestamp.style.textAlign = 'right';
    timestamp.style.marginTop = '2px';
    timestamp.style.color = isOutgoing ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 37, 35, 0.6)';
    bubble.appendChild(timestamp);

    container.appendChild(bubble);
  });

  // Automatically scroll to the bottom when rendered or updated
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 0);

  return container;
}
