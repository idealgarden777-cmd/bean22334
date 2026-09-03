"use strict";

/*
=========================================================
BEAN — MAIN ENTRY
=========================================================
*/

import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/app.css";

import { createAppShell } from "./components/app-shell.js";
import {
  renderChatList,
  initChatList,
} from "./components/chat-list.js";

import { renderChatView } from "./components/chat-view.js";

/*
=========================================================
APP ROOT
=========================================================
*/

const app = document.getElementById("app");

if (!app) {
  throw new Error("Bean: #app element not found.");
}

/*
=========================================================
APP INITIALIZATION
=========================================================
*/

function initApp() {
  // Render main Bean structure.
  app.innerHTML = createAppShell();

  // Render mock conversations.
  renderChatList();

  // Connect conversation selection to chat view.
  initChatList((conversation) => {
    renderChatView(conversation);
  });
}

/*
=========================================================
START
=========================================================
*/

initApp();
