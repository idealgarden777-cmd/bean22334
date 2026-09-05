"use strict";

/*
====================================================
BEAN — APP SHELL
====================================================

Owns:
- Main layout shell container configuration
- Assembly and composition of sidebar, chat view, and contact panel
- Root structural DOM hierarchy setup

Does not own:
- Individual component business logic or internal state
- Global CSS tokens or theme definitions
- Direct network requests or database routing
*/

import { Sidebar } from "./sidebar.js";
import { ChatView } from "./chat-view.js";
import { ContactPanel } from "./contact-panel.js";

export function AppShell(store) {
  // Create the root app shell container element
  const shellElement = document.createElement("div");
  shellElement.className = "app-shell";
  shellElement.setAttribute("role", "region");
  shellElement.setAttribute("aria-label", "Bean Chat Application Shell");

  // Initialize layout components with store dependency
  const sidebarElement = Sidebar(store);
  const chatViewElement = ChatView(store);
  const contactPanelElement = ContactPanel(store);

  // Append core layout components in correct structural sequence
  shellElement.appendChild(sidebarElement);
  shellElement.appendChild(chatViewElement);
  shellElement.appendChild(contactPanelElement);

  return shellElement;
}
