"use strict";

/*
=========================================================
BEAN — CHAT VIEW
=========================================================

Owns:
- Active conversation
- Chat component coordination
- Contact panel state
- Prototype message sending

Uses:
- chat-header.js
- message-list.js
- composer.js
- contact-panel.js
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

import {
  createContactPanel,
  initContactPanel,
} from "./contact-panel.js";


/*
=========================================================
STATE
=========================================================
*/

let activeConversation = null;
let isContactPanelOpen = false;


/*
=========================================================
HELPERS
=========================================================
*/

function isValidConversation(conversation) {
  return Boolean(
    conversation &&
    typeof conversation.id === "string" &&
    conversation.id.trim().length > 0
  );
}


function getCurrentTime() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}


/*
=========================================================
CONTACT PANEL
=========================================================
*/

function openContactPanel() {
  if (!activeConversation) {
    return;
  }

  isContactPanelOpen = true;

  renderChatView(activeConversation);
}


function closeContactPanel() {
  if (!activeConversation) {
    return;
  }

  isContactPanelOpen = false;

  renderChatView(activeConversation);
}


/*
=========================================================
HEADER ACTIONS
=========================================================
*/

function handleHeaderAction(action, conversation) {
  switch (action) {
    case "profile":
    case "info":
      openContactPanel();
      break;

    case "voice":
      console.log(
        `Bean: voice call with ${conversation.name}`
      );
      break;

    case "video":
      console.log(
        `Bean: video call with ${conversation.name}`
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
CONTACT PANEL ACTIONS
=========================================================
*/

function handleContactPanelAction(
  action,
  conversation
) {
  switch (action) {
    case "close":
      closeContactPanel();
      break;

    case "voice":
      console.log(
        `Bean: voice call with ${conversation.name}`
      );
      break;

    case "video":
      console.log(
        `Bean: video call with ${conversation.name}`
      );
      break;

    case "search":
      console.log(
        `Bean: search conversation with ${conversation.name}`
      );
      break;

    case "mute":
      console.log(
        `Bean: toggle mute for ${conversation.name}`
      );
      break;

    case "media":
      console.log(
        `Bean: open media for ${conversation.name}`
      );
      break;

    case "files":
      console.log(
        `Bean: open files for ${conversation.name}`
      );
      break;

    case "links":
      console.log(
        `Bean: open links for ${conversation.name}`
      );
      break;

    case "block":
      console.log(
        `Bean: block ${conversation.name}`
      );
      break;

    default:
      console.warn(
        `Bean: unknown contact action "${action}".`
      );
  }
}


/*
=========================================================
SEND MESSAGE
=========================================================
*/

function handleSendMessage(text, conversation) {
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

  renderChatView(conversation, {
    focusComposer: true,
  });

  return true;
}


/*
=========================================================
CREATE CHAT CONTENT
=========================================================
*/

function createChatContent(conversation) {
  const contactPanel = isContactPanelOpen
    ? createContactPanel(conversation)
    : "";

  return `
    <div class="bean-chat__conversation">

      ${createChatHeader(conversation)}

      ${createMessageList(conversation)}

      ${createComposer()}

    </div>

    ${contactPanel}
  `;
}


/*
=========================================================
INITIALIZE COMPONENTS
=========================================================
*/

function initComponents(conversation) {
  initChatHeader((action) => {
    handleHeaderAction(
      action,
      conversation
    );
  });


  initComposer((text) => {
    return handleSendMessage(
      text,
      conversation
    );
  });


  if (isContactPanelOpen) {
    initContactPanel((action) => {
      handleContactPanelAction(
        action,
        conversation
      );
    });
  }
}


/*
=========================================================
RENDER CHAT VIEW
=========================================================
*/

export function renderChatView(
  conversation,
  options = {}
) {
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


  const changedConversation =
    activeConversation &&
    activeConversation.id !== conversation.id;


  if (changedConversation) {
    isContactPanelOpen = false;
  }


  activeConversation = {
    ...conversation,
  };


  chatView.innerHTML =
    createChatContent(activeConversation);


  initComponents(activeConversation);


  scrollToLatestMessage();


  if (options.focusComposer === true) {
    focusComposer();
  }
}
