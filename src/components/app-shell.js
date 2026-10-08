/* App Shell — mounts every region once, then each region re-renders itself. */
import { store } from "../core/store.js";
import { ACCOUNTS_URL } from "../core/api.js";
import { escapeHtml } from "../core/utils.js";
import { logoMark } from "./logo.js";
import { mountSidebar } from "./sidebar.js";
import { mountChatView } from "./chat-view.js";
import { mountContactPanel } from "./contact-panel.js";
import { mountNewChat } from "./new-chat.js";

function renderGate(root, state) {
  if (state.status === "loading") {
    root.innerHTML = `<div class="gate"><div class="gate-card"><div class="spinner"></div><p>Loading Bean…</p></div></div>`;
    return;
  }
  if (state.status === "error") {
    root.innerHTML = `
      <div class="gate"><div class="gate-card">
        ${logoMark}<h1 class="gate-title">Bean</h1>
        <p>${escapeHtml(state.error || "Something went wrong.")}</p>
        <button class="btn-primary" type="button" data-action="reload">Try again</button>
      </div></div>`;
    root.querySelector("[data-action=reload]").onclick = () => location.reload();
    return;
  }
  const back = encodeURIComponent(location.href);
  root.innerHTML = `
    <div class="gate"><div class="gate-card">
      ${logoMark}<h1 class="gate-title">Bean</h1>
      <p>Sign in with your Bean ID to start chatting.</p>
      <a class="btn-primary" href="${ACCOUNTS_URL}/?redirect=${back}">Sign in with Bean ID</a>
      <small>One Bean ID for Neyo, Bean and every Signaturesi app.</small>
    </div></div>`;
}

function mountApp(root) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar"></aside>
      <main class="chat-view"></main>
      <aside class="contact-panel"></aside>
      <div class="modal-slot"></div>
    </div>`;

  const shell = root.querySelector(".app-shell");
  mountSidebar(shell.querySelector(".sidebar"));
  mountChatView(shell.querySelector(".chat-view"));
  mountContactPanel(shell.querySelector(".contact-panel"));
  mountNewChat(shell.querySelector(".modal-slot"));

  const sync = (state) => {
    shell.classList.toggle("chat-open", Boolean(state.activeId));
    shell.classList.toggle("panel-open", Boolean(state.activeId && state.contactPanelOpen));
  };
  store.subscribe(sync);
  sync(store.getState());

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const s = store.getState();
    if (s.newChatOpen) store.toggleNewChat(false);
    else if (s.contactPanelOpen) store.toggleContactPanel(false);
  });
}

export function mountAppShell(root) {
  if (!root) return;
  let mounted = false;

  const render = (state) => {
    if (state.status === "ready") {
      if (!mounted) {
        mounted = true;
        mountApp(root);
      }
      return;
    }
    mounted = false;
    renderGate(root, state);
  };

  store.subscribe(render);
  render(store.getState());
}
