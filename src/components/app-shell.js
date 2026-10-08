/* App shell: gate (loading / sign in) or the full messenger. */
import { store } from "../core/store.js";
import { escapeHtml } from "../core/utils.js";
import { logoMark } from "./logo.js";
import { mountSidebar } from "./sidebar.js";
import { mountChatView } from "./chat-view.js";
import { mountInfoPanel } from "./info-panel.js";
import { mountNewChat } from "./new-chat-modal.js";
import { mountSettings } from "./settings-modal.js";
import { mountCallOverlay } from "./call-overlay.js";
import { mountToast } from "./toast.js";
import { mountLightbox } from "./lightbox.js";

function renderGate(root, state) {
  if (state.status === "loading") {
    root.innerHTML = `<div class="gate"><div class="spinner"></div></div>`;
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
  // signed out: back to the Bean login screen
  root.innerHTML = `<div class="gate"><div class="spinner"></div></div>`;
  location.replace(`/?next=${encodeURIComponent(location.pathname + location.hash)}`);
}

function mountApp(root) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar"></aside>
      <main class="chat-view"></main>
      <aside class="info-panel"></aside>
      <div class="modal-slot"></div>
      <div class="settings-slot"></div>
      <div class="call-slot"></div>
      <div class="lightbox-slot"></div>
      <div class="toast-slot"></div>
    </div>`;

  const shell = root.querySelector(".app-shell");
  mountSidebar(shell.querySelector(".sidebar"));
  mountChatView(shell.querySelector(".chat-view"));
  mountInfoPanel(shell.querySelector(".info-panel"));
  mountNewChat(shell.querySelector(".modal-slot"));
  mountSettings(shell.querySelector(".settings-slot"));
  mountCallOverlay(shell.querySelector(".call-slot"));
  mountLightbox(shell.querySelector(".lightbox-slot"));
  mountToast(shell.querySelector(".toast-slot"));

  const sync = (s) => {
    shell.classList.toggle("chat-open", Boolean(s.activeId));
    shell.classList.toggle("panel-open", Boolean(s.activeId && s.panelOpen));
  };
  store.subscribe(sync);
  sync(store.getState());

  document.addEventListener("keydown", (e) => {
    const s = store.getState();
    if (e.key === "Escape") {
      if (document.querySelector(".lightbox")) return;
      if (s.modal) store.closeModal();
      else if (s.replyTo || s.editing) store.cancelCompose();
      else if (s.panelOpen) store.togglePanel(false);
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.querySelector(".search-pill input")?.focus();
    }
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
