/* ================================================================= *
 * Chat View Component - src/components/chat-view.js                 *
 * ================================================================= */

import { store } from '../core/store.js';
import { renderChatHeader } from './chat-header.js';
import { renderMessageList } from './message-list.js';
import { renderComposer } from './composer.js';

export function renderChatView(state) {
  const chatView = document.createElement('section');
  chatView.className = 'chat-view';
  chatView.style.flex = '1';
  chatView.style.display = 'flex';
  chatView.style.flexDirection = 'column';
  chatView.style.backgroundColor = 'var(--bg-bone)'; // Warm Off-White / Bone background[cite: 1]
  chatView.style.height = '100%';
  chatView.style.overflow = 'hidden';

  const activeContact = state.contacts.find(c => c.id === state.activeContactId);
  const messages = state.messages[state.activeContactId] || [];

  const header = renderChatHeader(activeContact);
  const messageList = renderMessageList(messages, state.currentUser);
  const composer = renderComposer();

  chatView.appendChild(header);
  chatView.appendChild(messageList);
  chatView.appendChild(composer);

  return chatView;
}
