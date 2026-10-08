import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml } from "../core/utils.js";

export function renderChatHeader(container) {
  const conv = store.getActiveConversation();
  if (!conv) return;
  const { contact } = conv;

  container.innerHTML = `
    <header class="chat-header-container">
      <button type="button" class="icon-btn back-btn" data-action="back" aria-label="Back to chats">${icons.arrowLeft}</button>
      <button type="button" class="chat-header-participant" data-action="info">
        ${avatar(contact)}
        <span class="participant-info">
          <span class="participant-name">${escapeHtml(contact.displayName)}</span>
          <span class="participant-status">${escapeHtml(contact.beanId)}</span>
        </span>
      </button>
      <div class="chat-header-actions">
        <button type="button" class="icon-btn" disabled title="Voice calls coming soon" aria-label="Voice call">${icons.phone}</button>
        <button type="button" class="icon-btn" disabled title="Video calls coming soon" aria-label="Video call">${icons.video}</button>
        <button type="button" class="icon-btn" data-action="info" title="Contact info" aria-label="Contact info">${icons.info}</button>
      </div>
    </header>`;

  container.querySelector("[data-action=back]").onclick = () => store.closeChat();
  container.querySelectorAll("[data-action=info]").forEach((btn) => {
    btn.onclick = () => store.toggleContactPanel();
  });
}
