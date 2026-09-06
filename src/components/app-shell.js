import { renderSidebar } from "./sidebar.js";
import { renderChatView } from "./chat-view.js";

export function mountAppShell(root) {
  root.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "app-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar";

  const chat = document.createElement("main");
  chat.className = "app-chat";

  shell.appendChild(sidebar);
  shell.appendChild(chat);
  root.appendChild(shell);

  renderSidebar(sidebar);
  renderChatView(chat);
}
