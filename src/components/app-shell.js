import { store } from "../core/store.js";
import { renderSidebar } from "./sidebar.js";
import { renderChatView } from "./chat-view.js";

export function AppShell() {
  const shell = document.createElement("div");
  shell.className = "app-shell";

  const sidebar = document.createElement("div");
  sidebar.className = "app-sidebar";

  const chat = document.createElement("div");
  chat.className = "app-chat";

  renderSidebar(sidebar);
  chat.appendChild(renderChatView());

  shell.appendChild(sidebar);
  shell.appendChild(chat);

  store.subscribe(() => {
    renderSidebar(sidebar);
    chat.innerHTML = "";
    chat.appendChild(renderChatView());
  });

  return shell;
}
