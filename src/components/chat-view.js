"use strict";

/*
=========================================================
BEAN — CHAT VIEW
=========================================================

Owns:
- Selected conversation layout
- Coordination between chat components
- Local prototype message sending
- Header action coordination

Uses:
- chat-header.js
- message-list.js
- composer.js

Does not own:
- Header UI
- Message rendering
- Composer UI
- Backend
- Realtime
- Persistence
=========================================================
*/

import {
  createChatHeader,
  initChatHeader,
} from "./chat-header.js";

import {
  createMessageList,
  addMessage,
  scrollToLatestMessage,
} from "./message-list.js";

import {
  createComposer,
  initComposer,
  focusComposer,
} from "./composer.js";

/*
=========================================================
TIME
=========================================================
*/

function getCurrentTime() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

/*
=========================================================
VALIDATION
=========================================================
*/

function isValidConversation(conversation) {
  return Boolean(
    conversation &&
      typeof conversation.id === "string" &&
      conversation.id.trim()
  );
}

/*
=========================================================
HEADER ACTIONS
=========================================================
*/

function handleHeaderAction(
  action,
  conversation
) {
  switch (action) {
    case "profile":
    case "info":
      console.log(
        `Bean: open details for ${conversation.name}`
      );
      break;

    case "voice":
      console.log(
        `Bean: start voice call with ${conversation.name}`
      );
      break;

    case "video":
      console.log(
        `Bean: start video call with ${conversation.name}`
      );
      break;

    case "search":
      console.log(
        `Bean: search conversation with ${conversation.name}`
      );
      break;

    default:
      console.warn(
        `Bean: unknown header action "${action}".`
      );
  }
}

/*
=========================================================
SEND MESSAGE
=========================================================
*/

function handleSendMessage(
  text,
  conversation
) {
  const added = addMessage(
    conversation.id,
    {
      direction: "outgoing",
      text,
      time: getCurrentTime(),
    }
  );

  if (!added) {
    return false;
  }

  renderChatView(conversation);

  focusComposer();

  return true;
}

/*
=========================================================
RENDER CHAT VIEW
=========================================================
*/

export function renderChatView(conversation) {
  const chatView =
    document.getElementById("chatView");

  if (!chatView) {
    console.warn(
      "Bean: #chatView element not found."
    );
    return;
  }

  if (!isValidConversation(conversation)) {
    console.warn(
      "Bean: invalid conversation."
    );
    return;
  }

  chatView.innerHTML = `
    ${createChatHeader(conversation)}
    ${createMessageList(conversation)}
    ${createComposer()}
  `;

  /*
  =======================================================
  HEADER
  =======================================================
  */

  initChatHeader((action) => {
    handleHeaderAction(
      action,
      conversation
    );
  });

  /*
  =======================================================
  COMPOSER
  =======================================================
  */

  initComposer((text) => {
    return handleSendMessage(
      text,
      conversation
    );
  });

  /*
  =======================================================
  FINAL UI STATE
  =======================================================
  */

  scrollToLatestMessage();
}
