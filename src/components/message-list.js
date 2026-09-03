"use strict";

import { getMessages } from "../core/store.js";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

export function createMessageList(conversation) {
  const items = getMessages(conversation.id);
  const content = items.length
    ? items.map((message) => `
        <div class="bean-message bean-message--${message.direction === "incoming" ? "incoming" : "outgoing"}">
          <div class="bean-message__bubble">
            <div>${escapeHTML(message.text)}</div>
            <small>${escapeHTML(message.time)}</small>
          </div>
        </div>
      `).join("")
    : '<div class="bean-empty bean-empty--messages"><p>Start the conversation.</p></div>';

  return `<section class="bean-messages" id="messageList"><div class="bean-messages__inner">${content}</div></section>`;
}

export function scrollToLatestMessage() {
  const list = document.getElementById("messageList");
  if (list) list.scrollTop = list.scrollHeight;
}
