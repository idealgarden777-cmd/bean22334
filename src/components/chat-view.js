import { renderChatHeader } from "./chat-header.js";
import { renderMessageList } from "./message-list.js";
import { renderComposer } from "./composer.js";

export function renderChatView(container) {
  container.innerHTML = `
    <div class="chat-view-container">
      <div class="chat-header-slot"></div>
      <div class="message-list-slot"></div>
      <div class="composer-slot"></div>
    </div>
  `;

  const headerSlot = container.querySelector(".chat-header-slot");
  const messageSlot = container.querySelector(".message-list-slot");
  const composerSlot = container.querySelector(".composer-slot");

  renderChatHeader(headerSlot);
  renderMessageList(messageSlot);
  renderComposer(composerSlot);
}
