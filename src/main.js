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
  initSidebar,
  setActiveSidebarView,
} from "./components/sidebar.js";

import {
  renderChatList,
  initChatList,
} from "./components/chat-list.js";

import {
  renderChatView,
} from "./components/chat-view.js";

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
NAVIGATION
=========================================================
*/

function handleNavigation(view) {
  setActiveSidebarView(view);

  /*
   * Actual Contacts, Search, Settings and Profile
   * views will be connected as we build them.
   */

  console.log(`Bean navigation: ${view}`);
}

/*
=========================================================
APP INITIALIZATION
=========================================================
*/

function initApp() {
  // Build application shell.
  app.innerHTML = createAppShell();

  // Render prototype conversations.
  renderChatList();

  // Connect sidebar navigation.
  initSidebar(handleNavigation);

  // Connect conversation selection.
  initChatList((conversation) => {
    renderChatView(conversation);
  });
}

/*
=========================================================
START BEAN
=========================================================
*/

initApp();
