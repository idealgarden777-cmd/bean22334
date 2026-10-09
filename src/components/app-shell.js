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
  setup: {
    title: "Chat Lock banayein",
    text: "Bean ab end-to-end encrypted hai. Chat Lock aap ki chats ki chaabi ko lock karta hai. Ye sirf aap ke paas rehta hai: Bean ke server par kabhi nahi jaata.",
    button: "Chat Lock set karein",
    confirm: true,
    check: "Main samajhta hun: Chat Lock bhool gaya to purani encrypted chats wapas nahi aa saktin. Bean bhi recover nahi kar sakta.",
  },
  unlock: {
    title: "Chats unlock karein",
    text: "Is device par pehli baar? Apna Chat Lock likhein. Login password nahi: Chat Lock.",
    button: "Unlock",
    confirm: false,
  },
  reset: {
    title: "Naya Chat Lock",
    text: "Reset se nayi key banegi. Purane encrypted messages is account par nahi khulenge, aur aap ke contacts ko \"security key badal gayi\" dikhega.",
    button: "Reset karke naya Chat Lock",
    confirm: true,
    check: "Haan, mujhe purani encrypted chats kho jaane ka pata hai. Reset karo.",
    danger: true,
  },
};

function renderLock(root, state) {
  const mode = state.lockMode || "unlock";
  const c = LOCK_COPY[mode];
  root.innerHTML = `
    <div class="gate"><form class="gate-card lock-card" autocomplete="off">
      <div class="lock-icon">${icons.lockLg}</div>
      <h1 class="gate-title">${c.title}</h1>
      <p>${escapeHtml(c.text)}</p>
      <input class="set-input" type="password" name="pass" placeholder="${mode === "unlock" ? "Chat Lock" : "Chat Lock (kam az kam 10 characters)"}" autocomplete="${mode === "unlock" ? "current-password" : "new-password"}" maxlength="200" required>
      ${c.confirm ? `<input class="set-input" type="password" name="again" placeholder="Dobara likhein" autocomplete="new-password" maxlength="200" required>
      <small class="set-note">Lamba jumla behtar hai, jaise "meri chai mein do cheeni 2026". Login password se alag rakhein.</small>` : ""}
      ${c.check ? `<label class="lock-check"><input type="checkbox" name="ok"> <span>${escapeHtml(c.check)}</span></label>` : ""}
      <p class="modal-error" hidden></p>
      <button type="submit" class="btn-primary ${c.danger ? "btn-danger" : ""}">${c.button}</button>
      <div class="lock-links">
        ${mode === "unlock" ? `<button type="button" class="link-btn" data-mode="reset">Chat Lock bhool gaye?</button>` : ""}
        ${mode === "reset" ? `<button type="button" class="link-btn" data-mode="unlock">Wapas</button>` : ""}
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
    if (c.confirm) {
      if (pass.length < 10) return show("Chat Lock kam az kam 10 characters ka ho");
      if (pass !== f.again.value) return show("Dono Chat Lock match nahi karte");
      if (!f.ok.checked) return show("Pehle checkbox par tick karein");
    }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Securing…";
    try {
      if (mode === "setup") await store.setupLock(pass);
      else if (mode === "reset") await store.resetLock(pass);
      else await store.unlock(pass);
    } catch (err) {
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
