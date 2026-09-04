/* ================================================================= *
 * Message List Component - src/components/message-list.js           *
 * ================================================================= */

export function renderMessageList(messages, currentUser) {
  const container = document.createElement('div');
  container.className = 'message-list';
  container.style.flex = '1';
  container.style.overflowY = 'auto';
  container.style.padding = '16px'; //[cite: 1]
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '3px'; // Tighter gap for seamless stacking

  if (!messages || messages.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.textContent = 'No messages yet. Start the conversation!';
    emptyState.style.textAlign = 'center';
    emptyState.style.color = 'rgba(44, 37, 35, 0.5)';
    emptyState.style.marginTop = '40px';
    emptyState.style.fontSize = '14px'; //[cite: 1]
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
    bubble.style.padding = '10px 16px';
    bubble.style.fontSize = '14px'; //[cite: 1]
    bubble.style.lineHeight = '1.4';
    bubble.style.position = 'relative';
    bubble.style.wordBreak = 'break-word';

    if (isOutgoing) {
      bubble.style.backgroundColor = 'var(--accent-sage)'; //[cite: 1]
      bubble.style.color = '#FFFFFF';
      bubble.style.alignSelf = 'flex-end';

      // Full pill-like shape with a crisp Instagram-style corner tail on the bottom-right for the last message
      let tl = '20px', tr = '20px', br = '20px', bl = '20px';
      if (!isSameAsNext) {
        br = '4px'; // Tail corner
      }
      if (isSameAsPrev) {
        tr = '6px';
      }
      if (isSameAsNext) {
        br = '6px';
      }
      bubble.style.borderRadius = `${tl} ${tr} ${br} ${bl}`;
    } else {
      bubble.style.backgroundColor = 'var(--surface-sand)'; //[cite: 1]
      bubble.style.color = 'var(--text-espresso)'; //[cite: 1]
      bubble.style.alignSelf = 'flex-start';

      let tl = '20px', tr = '20px', br = '20px', bl = '20px';
      if (!isSameAsNext) {
        bl = '4px'; // Tail corner
      }
      if (isSameAsPrev) {
        tl = '6px';
      }
      if (isSameAsNext) {
        bl = '6px';
      }
      bubble.style.borderRadius = `${tl} ${tr} ${br} ${bl}`;
    }

    const text = document.createElement('div');
    text.textContent = msg.text;
    bubble.appendChild(text);

    const timestamp = document.createElement('span');
    timestamp.textContent = `${msg.timestamp} ${isOutgoing ? '✓✓' : ''}`; //[cite: 1]
    timestamp.style.fontSize = '11px';
    timestamp.style.display = 'block';
    timestamp.style.textAlign = 'right';
    timestamp.style.marginTop = '4px';
    timestamp.style.color = isOutgoing ? 'rgba(255, 255, 255, 0.8)' : 'rgba(44, 37, 35, 0.6)';
    bubble.appendChild(timestamp);

    container.appendChild(bubble);
  });

  return container;
}
