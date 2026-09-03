"use strict";

/* =========================================================
   BEAN — MAIN
   Application entry point
   ========================================================= */


/* =========================================================
   STYLES
   ========================================================= */

import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/app.css";


/* =========================================================
   COMPONENTS
   ========================================================= */

import {
  createAppShell,
} from "./components/app-shell.js";

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


/* =========================================================
   STORE
   ========================================================= */

import {
  setCurrentView,
} from "./core/store.js";


/* =========================================================
   ROOT
   ========================================================= */

const app =
  document.getElementById("app");

if (!app) {
  throw new Error(
    "Bean: #app element not found."
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function handleNavigation(view) {
  if (!view) {
    return;
  }

  setCurrentView(view);
  setActiveSidebarView(view);


  /* ---------------------------------------------------------
     Current prototype behavior

     Chats = active working view.

     Contacts / Search / Settings / Profile
     will be connected later without changing
     the core app architecture.
     --------------------------------------------------------- */

  if (view !== "chats") {
    console.log(
      `Bean navigation: ${view}`
    );
  }
}


/* =========================================================
   NEW CHAT
   ========================================================= */

function initNewChatActions() {
  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target;

      if (
        !(target instanceof Element)
      ) {
        return;
      }

      const button =
        target.closest(
          "[data-new-chat]"
        );

      if (!button) {
        return;
      }

      /*
       * New chat screen will be connected later.
       * Keeping this action centralized prevents
       * duplicate listeners across components.
       */

      console.log(
        "Bean action: new chat"
      );
    }
  );
}


/* =========================================================
   INITIALIZE APPLICATION
   ========================================================= */

function initApp() {
  /* ---------------------------------------------------------
     1. Mount permanent app shell
     --------------------------------------------------------- */

  app.innerHTML =
    createAppShell();


  /* ---------------------------------------------------------
     2. Render conversations
     --------------------------------------------------------- */

  renderChatList();


  /* ---------------------------------------------------------
     3. Initialize primary navigation
     --------------------------------------------------------- */

  initSidebar(
    handleNavigation
  );


  /* ---------------------------------------------------------
     4. Initialize chat selection
     --------------------------------------------------------- */

  initChatList(() => {
    renderChatView();
  });


  /* ---------------------------------------------------------
     5. Global shell actions
     --------------------------------------------------------- */

  initNewChatActions();
}


/* =========================================================
   START
   ========================================================= */

initApp();
