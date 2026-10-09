/* App shell: gate (loading / sign in) or the full messenger. */
import { store } from "../core/store.js";
import { escapeHtml } from "../core/utils.js";
import { logoMark } from "./logo.js";
import { icons } from "./icons.js";
import { mountSidebar } from "./sidebar.js";
import { mountChatView } from "./chat-view.js";
import { mountInfoPanel } from "./info-panel.js";
import { mountNewChat } from "./new-chat-modal.js";
import { mountSettings } from "./settings-modal.js";
import { mountCallOverlay } from "./call-overlay.js";
import { mountToast } from "./toast.js";
import { mountLightbox } from "./lightbox.js";

const LOCK_COPY = {
  password: {
    title: "Apna Bean password likhein",
    text: "Bas ek baar, is device par apni encrypted chats kholne ke liye. Wahi password jo login mein lagta hai.",
    placeholder: "Bean password",
    button: "Chats kholein",
  },
  oldlock: {
    title: "Purana Chat Lock likhein",
    text: "Aap ne pehle alag Chat Lock banaya tha. Ek dafa likh dein, phir aage se sirf Bean password kaafi hoga.",
    placeholder: "Purana Chat Lock",
    button: "Unlock",
  },
  reset: {
    title: "Naye sire se shuru karein",
    text: "Nayi key banegi. Purane encrypted messages is account par nahi khulenge, nayi chats theek chalengi.",
    placeholder: "Bean password",
    button: "Naya shuru karein",
    check: "Haan, purani encrypted chats chhod kar naya shuru karo.",
    danger: true,
  },
};

function renderLock(root, state) {
  const mode = LOCK_COPY[state.lockMode] ? state.lockMode : "password";
  const c = LOCK_COPY[mode];
  root.innerHTML = `
    <div class="gate"><form class="gate-card lock-card" autocomplete="off">
      <div class="lock-icon">${icons.lockLg}</div>
      <h1 class="gate-title">${c.title}</h1>
      <p>${escapeHtml(c.text)}</p>
      <input class="set-input" type="password" name="pass" placeholder="${c.placeholder}" autocomplete="current-password" maxlength="200" required>
      ${c.check ? `<label class="lock-check"><input type="checkbox" name="ok"> <span>${escapeHtml(c.check)}</span></label>` : ""}
      <p class="modal-error" hidden></p>
      <button type="submit" class="btn-primary ${c.danger ? "btn-danger" : ""}">${c.button}</button>
      <div class="lock-links">
        ${mode === "oldlock" ? `<button type="button" class="link-btn" data-mode="reset">Yaad nahi?</button>` : ""}
        ${mode === "reset" ? `<button type="button" class="link-btn" data-mode="password">Wapas</button>` : ""}
        <button type="button" class="link-btn" data-action="logout">Sign out</button>
      </div>
    </form></div>`;
  const form = root.querySelector("form");
  const f = form.elements;
  const error = root.querySelector(".modal-error");
  const show = (t) => Object.assign(error, { hidden: false, textContent: t });
  root.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => store.setLockMode(b.dataset.mode)));
  root.querySelector("[data-action=logout]").onclick = () => store.logout();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.hidden = true;
    const pass = f.pass.value;
    if (c.check && !f.ok.checked) return show("Pehle checkbox par tick karein");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Kholi ja rahi hain…";
    try {
      if (mode === "oldlock") await store.unlockOldLock(pass);
      else if (mode === "reset") await store.resetWithPassword(pass);
      else await store.unlockWithPassword(pass);
    } catch (err) {
      if (err.code === "SWITCHED") return; // screen moves to "Purana Chat Lock"
      show(err.code === "WRONG_PASSPHRASE" ? "Chat Lock galat hai" : err.message || "Kuch ghalat ho gaya");
      btn.disabled = false;
      btn.textContent = c.button;
    }
  });
  try { f.pass.focus(); } catch {}
}

function renderGate(root, state) {
  if (state.status === "locked") return renderLock(root, state);
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
  let lastGate = "";
  const render = (state) => {
    if (state.status === "ready") {
      if (!mounted) {
        mounted = true;
        lastGate = "";
        mountApp(root);
      }
      return;
    }
    if (mounted && state.status === "loading") return;
    mounted = false;
    const gateKey = `${state.status}|${state.lockMode}|${state.error}`;
    if (gateKey === lastGate) return;
    lastGate = gateKey;
    renderGate(root, state);
  };
  store.subscribe(render);
  render(store.getState());
}
