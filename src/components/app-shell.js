import { renderSidebar } from "./sidebar.js";
import { renderChatView } from "./chat-view.js";
import { renderContactPanel } from "./contact-panel.js";

export function mountAppShell(root) {
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar";

  const chat = document.createElement("main");
  chat.className = "app-chat";

  const contactPanel = document.createElement("aside");
  contactPanel.className = "app-contact-panel";

  shell.appendChild(sidebar);
  shell.appendChild(chat);
  shell.appendChild(contactPanel);

  root.appendChild(shell);

  renderSidebar(sidebar);
  renderChatView(chat);
  renderContactPanel(contactPanel);
}
