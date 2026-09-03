"use strict";

/* =========================================================
   BEAN — CHAT VIEW
   Main conversation coordinator
   ========================================================= */

import {
  addMessage,
  getActiveConversation,
  isContactPanelOpen,
  openContactPanel,
  closeContactPanel,
} from "../core/store.js";

import {
  renderChatList,
} from "./chat-list.js";

import {
  createChatHeader,
  initChatHeader,
} from "./chat-header.js";

import {
  createMessageList,
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


/* =========================================================
   HELPERS
   ========================================================= */

function currentTime() {
  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(new Date());
}


function currentDateLabel() {
  return "Today";
}


function runPlaceholderAction(
  action,
  conversation
) {
  console.log(
    `Bean action: ${action} -> ${conversation.name}`
  );
}


/* =========================================================
   MOBILE BACK
   ========================================================= */

function closeMobileWorkspace() {
  const workspace =
    document.querySelector(
      ".bean-workspace"
    );

  if (!workspace) {
    return;
  }

  workspace.classList.remove(
    "is-open"
  );
}


/* =========================================================
   RENDER
   ========================================================= */

export function renderChatView(
  options = {}
) {
  const root =
    document.getElementById(
      "chatView"
    );

  const conversation =
    getActiveConversation();

  if (
    !root ||
    !conversation
  ) {
    return;
  }


  root.innerHTML = `
    <div class="bean-chat__conversation">

      ${createChatHeader(
        conversation
      )}

      ${createMessageList(
        conversation
      )}

      <div class="bean-composer-area">
        ${createComposer()}
      </div>

    </div>

    ${
      isContactPanelOpen()
        ? createContactPanel(
            conversation
          )
        : ""
    }
  `;


  /* =======================================================
     HEADER ACTIONS
     ======================================================= */

  initChatHeader((action) => {
    if (action === "back") {
      closeContactPanel();
      closeMobileWorkspace();
      return;
    }

    if (action === "info") {
      if (!isContactPanelOpen()) {
        openContactPanel();
      }

      renderChatView();
      return;
    }

    runPlaceholderAction(
      action,
      conversation
    );
  });


  /* =======================================================
     COMPOSER
     ======================================================= */

  initComposer({
    onSend(text) {
      const message =
        addMessage(
          conversation.id,
          {
            text,
            direction: "outgoing",
            time: currentTime(),
            date: currentDateLabel(),
            seen: true,
          }
        );

      if (!message) {
        return;
      }

      renderChatList();
      renderChatView({
        focus: true,
      });
    },

    onAction(action) {
      runPlaceholderAction(
        action,
        conversation
      );
    },
  });


  /* =======================================================
     CONTACT PANEL
     ======================================================= */

  const contactPanel =
    document.getElementById(
      "contactPanel"
    );

  if (contactPanel) {
    initContactPanel(
      contactPanel,
      (action) => {
        if (action === "close") {
          closeContactPanel();
          renderChatView();
          return;
        }

        runPlaceholderAction(
          action,
          conversation
        );
      }
    );
  }


  /* =======================================================
     FINALIZE
     ======================================================= */

  scrollToLatestMessage();

  if (options.focus) {
    focusComposer();
  }
}
