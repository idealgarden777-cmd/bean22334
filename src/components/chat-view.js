"use strict";

/*
=========================================================
BEAN — CHAT VIEW
=========================================================

Owns:
- Selected conversation layout
- Coordination between chat components
- Contact panel open / close state
- Local prototype message sending
- Header action coordination

Uses:
- chat-header.js
- message-list.js
- composer.js
- contact-panel.js

Does not own:
- Header UI
- Message rendering
- Composer UI
- Contact panel UI
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
CONTACT PANEL
=========================================================
*/

function openContactPanel() {
  if (!activeConversation) {
    return;
  }

  isContactPanelOpen = true;

  renderChatView(
    activeConversation,
    {
      focusComposerAfterRender: false,
    }
  );
}

function closeContactPanel() {
  if (!activeConversation) {
    return;
  }

  isContactPanelOpen = false;

  renderChatView(
    activeConversation,
    {
      focusComposerAfterRender: false,
    }
  );
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

    case "mute":
      console.log(
        `Bean: toggle mute for ${conversation.name}`
      );
      break;

    case "media":
      console.log(
        `Bean: open shared media with ${conversation.name}`
      );
      break;

    case "files":
      console.log(
        `Bean: open shared files with ${conversation.name}`
      );
      break;

    case "links":
      console.log(
        `Bean: open shared links with ${conversation.name}`
      );
      break;

    case "block":
      console.log(
        `Bean: block action for ${conversation.name}`
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
      openContactPanel();
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

  renderChatView(
    conversation,
    {
      focusComposerAfterRender: true,
    }
  );

  return true;
}

/*
=========================================================
CREATE CHAT CONTENT
=========================================================
*/

function createChatContent(conversation) {
  return `
    <div class="bean-chat__conversation">

      ${createChatHeader(conversation)}

      ${createMessageList(conversation)}

      ${createComposer()}

    </div>

    ${
      isContactPanelOpen
        ? createContactPanel(conversation)
        : ""
    }
  `;
}

/*
=========================================================
INITIALIZE COMPONENTS
=========================================================
*/

function initChatComponents(conversation) {
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
  const {
    focusComposerAfterRender = false,
  } = options;

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

  /*
   * If user selects another conversation,
   * close the previous details panel.
   */
  if (
    activeConversation &&
    activeConversation.id !== conversation.id
  ) {
    isContactPanelOpen = false;
  }

  activeConversation = conversation;

  chatView.innerHTML =
    createChatContent(conversation);

  initChatComponents(conversation);

  scrollToLatestMessage();

  if (focusComposerAfterRender) {
    focusComposer();
  }
}
