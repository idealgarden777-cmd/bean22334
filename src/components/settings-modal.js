/* Settings — same fields as the original Bean:
 * Display Name · New Password · Update Identity · Default Message Timer · Chat Wallpaper
 * plus appearance, notifications and sign out. */
import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml } from "../core/utils.js";
import { isDark, toggleTheme } from "../core/theme.js";
import { notificationsSupported } from "../core/notify.js";

export const TIMERS = [
  { value: 0, label: "Off (Keep Forever)", short: "Off" },
  { value: 86400, label: "24 Hours", short: "24h" },
  { value: 604800, label: "7 Days", short: "7d" },
  { value: 2592000, label: "30 Days", short: "30d" },
];
export const WALLPAPERS = [
  { id: "none", label: "Plain" },
  { id: "dots", label: "Dots" },
  { id: "grid", label: "Grid" },
  { id: "sand", label: "Sand" },
  { id: "mist", label: "Mist" },
  { id: "night", label: "Night" },
];

const GHOST_HOURS = [
  { value: 0, label: "Until I'm back" },
  { value: 1, label: "1h" },
  { value: 3, label: "3h" },
  { value: 8, label: "8h" },
];
const ghostNote = (s) =>
  s.ghostEnabled
    ? `On${s.ghostUntil ? ` until ${new Date(s.ghostUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}. Simple messages get a 👻 Ghost reply; money, plans and private things wait for you.`
    : "When it's off again, Neyo sends you a handoff report.";

export function timerLabel(seconds) {
  return TIMERS.find((t) => t.value === Number(seconds))?.label || "Off (Keep Forever)";
}

export function mountSettings(container) {
  let open = false;

  const render = (state) => {
    const want = state.modal === "settings";
    if (want === open) return;
    open = want;
    if (!open) return (container.innerHTML = "");

    const { me, settings } = state;
    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal settings" role="dialog" aria-modal="true" aria-label="Settings">
          <div class="modal-header">
            <h2 class="modal-title">Settings</h2>
            <button type="button" class="icon-btn" data-close aria-label="Close">${icons.close}</button>
          </div>

          <div class="settings-body">
            <div class="settings-me">
              ${avatar(me, "lg")}
              <strong>${escapeHtml(me.displayName)}</strong>
              <small>${escapeHtml(me.beanId)}</small>
            </div>

            <form class="settings-form" autocomplete="off">
              <label class="set-label" for="editUsername">Display Name</label>
              <input id="editUsername" class="set-input" type="text" maxlength="40" value="${escapeHtml(me.displayName)}">
              <label class="set-label" for="editPassword">New Password</label>
              <input id="editPassword" class="set-input" type="password" placeholder="Leave blank to keep current" autocomplete="new-password" maxlength="100">
              <p class="modal-error" hidden></p>
              <button type="submit" class="btn-primary">Update Identity</button>
            </form>

            <div class="set-section ghost-section">
              <button type="button" class="set-row ghost-row" data-action="ghost" role="switch" aria-checked="${settings.ghostEnabled}">
                <span>👻</span><span><strong>Neyo Ghost</strong><small>Away? Ghost replies to your DMs</small></span><i class="switch ${settings.ghostEnabled ? "on" : ""}"></i>
              </button>
              <label class="set-label" for="ghostNote">What Ghost can tell people</label>
              <textarea id="ghostNote" class="set-input ghost-note" rows="2" maxlength="500" placeholder="e.g. Meeting mein hun, 6 baje ke baad free hun">${escapeHtml(settings.ghostNote || "")}</textarea>
              <div class="timer-options ghost-hours" role="radiogroup" aria-label="Ghost duration">
                ${GHOST_HOURS.map((h) => `<button type="button" role="radio" data-hours="${h.value}" class="${h.value === 0 ? "on" : ""}" aria-checked="${h.value === 0}">${h.label}</button>`).join("")}
              </div>
              <small class="set-note" data-ghost-note>${ghostNote(settings)}</small>
            </div>

            <div class="set-section">
              <span class="set-label">Default Message Timer</span>
              <div class="timer-options" role="radiogroup">
                ${TIMERS.map((t) => `<button type="button" role="radio" data-timer="${t.value}" class="${t.value === settings.messageTimer ? "on" : ""}" aria-checked="${t.value === settings.messageTimer}">${t.short}</button>`).join("")}
              </div>
              <small class="set-note" data-timer-note>${settings.messageTimer ? `New messages you send disappear after ${timerLabel(settings.messageTimer).toLowerCase()}.` : "Messages are kept forever."}</small>
            </div>

            <div class="set-section">
              <span class="set-label">Chat Wallpaper</span>
              <div class="wallpaper-grid">
                ${WALLPAPERS.map((w) => `<button type="button" class="wp wp-${w.id} ${w.id === settings.wallpaper ? "on" : ""}" data-wallpaper="${w.id}" aria-label="${w.label}"><span>${w.label}</span></button>`).join("")}
              </div>
            </div>

            <div class="set-rows">
              <button type="button" class="set-row" data-action="theme"><span>${icons.moon}</span><span>Dark mode</span><i class="switch ${isDark() ? "on" : ""}"></i></button>
              ${notificationsSupported() ? `<button type="button" class="set-row" data-action="notify"><span>${icons.bell}</span><span>Notifications</span><small>${state.notifPermission === "granted" ? "On" : state.notifPermission === "denied" ? "Blocked in browser" : "Turn on"}</small></button>` : ""}
              <button type="button" class="set-row danger" data-action="logout"><span>${icons.logout}</span><span>Sign out</span></button>
            </div>
          </div>
        </div>
      </div>`;

    const $ = (sel) => container.querySelector(sel);
    const error = $(".modal-error");
    const close = () => store.closeModal();
    $("[data-close]").onclick = close;
    $(".modal-backdrop").addEventListener("mousedown", (e) => e.target === e.currentTarget && close());

    $(".settings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      const btn = e.currentTarget.querySelector(".btn-primary");
      const displayName = $("#editUsername").value.trim();
      const password = $("#editPassword").value;
      if (!displayName) return Object.assign(error, { hidden: false, textContent: "Display name can't be empty" });
      if (password && password.length < 10) return Object.assign(error, { hidden: false, textContent: "Password must be at least 10 characters" });
      btn.disabled = true;
      try {
        await store.updateSettings({ displayName, ...(password ? { password } : {}) });
        $("#editPassword").value = "";
        $(".settings-me strong").textContent = store.getState().me.displayName;
        store.toast(password ? "Name and password updated" : "Identity updated");
      } catch (err) {
        Object.assign(error, { hidden: false, textContent: err.message });
      } finally {
        btn.disabled = false;
      }
    });

    container.querySelectorAll("[data-timer]").forEach((b) => {
      b.onclick = async () => {
        const value = Number(b.dataset.timer);
        container.querySelectorAll("[data-timer]").forEach((x) => {
          x.classList.toggle("on", x === b);
          x.setAttribute("aria-checked", String(x === b));
        });
        $("[data-timer-note]").textContent = value ? `New messages you send disappear after ${timerLabel(value).toLowerCase()}.` : "Messages are kept forever.";
        try {
          await store.updateSettings({ messageTimer: value });
        } catch (err) {
          store.toast(err.message);
        }
      };
    });

    container.querySelectorAll("[data-wallpaper]").forEach((b) => {
      b.onclick = async () => {
        container.querySelectorAll("[data-wallpaper]").forEach((x) => x.classList.toggle("on", x === b));
        try {
          await store.updateSettings({ wallpaper: b.dataset.wallpaper });
        } catch (err) {
          store.toast(err.message);
        }
      };
    });

    let ghostHours = 0;
    container.querySelectorAll("[data-hours]").forEach((b) => {
      b.onclick = () => {
        ghostHours = Number(b.dataset.hours);
        container.querySelectorAll("[data-hours]").forEach((x) => {
          x.classList.toggle("on", x === b);
          x.setAttribute("aria-checked", String(x === b));
        });
      };
    });
    const ghostBtn = $("[data-action=ghost]");
    const refreshGhost = () => {
      const st = store.getState().settings;
      ghostBtn.querySelector(".switch").classList.toggle("on", st.ghostEnabled);
      ghostBtn.setAttribute("aria-checked", String(st.ghostEnabled));
      $("[data-ghost-note]").textContent = ghostNote(st);
    };
    ghostBtn.onclick = async () => {
      const turnOn = !store.getState().settings.ghostEnabled;
      ghostBtn.disabled = true;
      try {
        await store.setGhost(turnOn ? { ghostEnabled: true, ghostNote: $("#ghostNote").value, ghostHours } : { ghostEnabled: false });
      } catch (err) {
        store.toast(err.message);
      } finally {
        ghostBtn.disabled = false;
        refreshGhost();
      }
    };
    $("#ghostNote").addEventListener("change", async (e) => {
      try {
        await store.updateSettings({ ghostNote: e.target.value });
      } catch (err) {
        store.toast(err.message);
      }
    });

    $("[data-action=theme]").onclick = (e) => {
      toggleTheme();
      e.currentTarget.querySelector(".switch").classList.toggle("on", isDark());
    };
    const notify = $("[data-action=notify]");
    if (notify) notify.onclick = async () => {
      await store.enableNotifications();
      const p = store.getState().notifPermission;
      notify.querySelector("small").textContent = p === "granted" ? "On" : p === "denied" ? "Blocked in browser" : "Turn on";
    };
    $("[data-action=logout]").onclick = () => store.logout();
  };

  store.subscribe(render);
  render(store.getState());
}
