"use strict";

import { addMessage, closeContactPanel, getActiveConversation, isContactPanelOpen, openContactPanel } from "../core/store.js";
import { renderChatList } from "./chat-list.js";
import { createChatHeader, initChatHeader } from "./chat-header.js";
import { createMessageList, scrollToLatestMessage } from "./message-list.js";
import { createComposer, focusComposer, initComposer } from "./composer.js";
import { createContactPanel, initContactPanel } from "./contact-panel.js";

function currentTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function placeholderAction(action, conversation) {
  console.log(`Bean: ${action} -> ${conversation.name}`);
}

export function renderChatView(options = {}) {
  const root = document.getElementById("chatView");
  const conversation = getActiveConversation();
  if (!root || !conversation) return;

  root.innerHTML = `
    <div class="bean-chat__conversation">
      ${createChatHeader(conversation)}
      ${createMessageList(conversation)}
      ${createComposer()}
    </div>
    ${isContactPanelOpen() ? createContactPanel(conversation) : ""}
  `;

  initChatHeader((action) => {
    if (action === "info") {
      openContactPanel();
      renderChatView();
      return;
    }
    placeholderAction(action, conversation);
  });

  initComposer((text) => {
    if (!addMessage(conversation.id, text, currentTime())) return;
    renderChatList();
    renderChatView({ focus: true });
  });

  if (isContactPanelOpen()) {
    initContactPanel((action) => {
      if (action === "close") {
        closeContactPanel();
        renderChatView();
        return;
      }
      placeholderAction(action, conversation);
    });
  }

  scrollToLatestMessage();
  if (options.focus) focusComposer();
}
