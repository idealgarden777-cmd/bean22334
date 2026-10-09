/* Settings — same fields as the original Bean:
 * Display Name · New Password · Update Identity · Default Message Timer · Chat Wallpaper
 * plus appearance, notifications and sign out. */
import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml } from "../core/utils.js";
import { isDark, toggleTheme } from "../core/theme.js";
import { notificationsSupported } from "../core/notify.js";
import { e2ee } from "../core/e2ee.js";
import { api } from "../core/api.js";

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
    ? `On${s.ghostUntil ? ` until ${new Date(s.ghostUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}. Contacts see you're away with your note.`
    : "Wapas aane par Neyo batayega kis ne kitne messages bheje (content nahi).";
const GHOST_DISCLOSURE = "Ghost sirf aap ka \"away\" status aur ye note contacts ko dikhata hai. Ye note status ki tarah server par save hota hai, encrypted nahi: is mein private baat na likhein. Ghost aap ke messages kabhi nahi parhta aur na jawab deta hai (chats end-to-end encrypted hain).";

const fpGroups = (fp) => (fp || "").slice(0, 32).match(/.{1,4}/g)?.join(" ") || "";

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
              <div class="current-pass" hidden>
                <label class="set-label" for="currentPassword">Current Password</label>
                <input id="currentPassword" class="set-input" type="password" autocomplete="current-password" maxlength="100">
                <small class="set-note">Password badalne par baaqi sab devices se sign out ho jayega.</small>
              </div>
              <p class="modal-error" hidden></p>
              <button type="submit" class="btn-primary">Update Identity</button>
            </form>

            <div class="set-section security-section">
              <span class="set-label">${icons.lock} Security</span>
              <div class="sec-status"><strong>End-to-end encryption: On</strong><small>Aap ki key: <code>${escapeHtml(fpGroups(e2ee.fp))}</code></small></div>
              <div class="set-rows">
                <button type="button" class="set-row" data-action="lock-device"><span>${icons.shield}</span><span>Is device se key hatayein</span><small>Agli baar password se unlock hoga</small></button>
              </div>
              <span class="set-label">Devices</span>
              <div class="device-list"><small class="set-note">Loading…</small></div>
              <button type="button" class="set-row danger" data-action="logout-all"><span>${icons.logout}</span><span>Log out all devices</span></button>
              <small class="set-note">${escapeHtml(`Bean v${state.build?.version || "2.1.0"}${state.build?.commit ? ` · build ${state.build.commit}` : ""}`)} · <a href="/security" target="_blank" rel="noopener">Security &amp; privacy</a>${state.build?.repo ? ` · <a href="${escapeHtml(state.build.repo)}" target="_blank" rel="noopener">Source code</a>` : ""}</small>
            </div>

            <div class="set-section ghost-section">
              <button type="button" class="set-row ghost-row" data-action="ghost" role="switch" aria-checked="${settings.ghostEnabled}">
                <span>👻</span><span><strong>Ghost · Away Mode</strong><small>Contacts ko batayein ke aap away hain</small></span><i class="switch ${settings.ghostEnabled ? "on" : ""}"></i>
              </button>
              <label class="set-label" for="ghostNote">Away note (contacts dekhenge)</label>
              <textarea id="ghostNote" class="set-input ghost-note" rows="2" maxlength="160" placeholder="e.g. Meeting mein hun, 6 baje ke baad free hun">${escapeHtml(settings.ghostNote || "")}</textarea>
              <div class="timer-options ghost-hours" role="radiogroup" aria-label="Away duration">
                ${GHOST_HOURS.map((h) => `<button type="button" role="radio" data-hours="${h.value}" class="${h.value === 0 ? "on" : ""}" aria-checked="${h.value === 0}">${h.label}</button>`).join("")}
              </div>
              <p class="ghost-disclosure">${escapeHtml(GHOST_DISCLOSURE)}</p>
              <label class="lock-check" ${settings.ghostEnabled ? "hidden" : ""}><input type="checkbox" data-ghost-ok> <span>Samajh gaya, Ghost on karo.</span></label>
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
      const currentPassword = $("#currentPassword").value;
      if (!displayName) return Object.assign(error, { hidden: false, textContent: "Display name can't be empty" });
      if (password && password.length < 10) return Object.assign(error, { hidden: false, textContent: "Password must be at least 10 characters" });
      if (password && !currentPassword) return Object.assign(error, { hidden: false, textContent: "Current password likhein" });
      btn.disabled = true;
      try {
        await (password ? store.changePassword({ displayName, password, currentPassword }) : store.updateSettings({ displayName }));
        $("#editPassword").value = "";
        $("#currentPassword").value = "";
        $(".current-pass").hidden = true;
        if (password) loadDevices();
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
      const ok = $("[data-ghost-ok]");
      ok.checked = false;
      ok.closest("label").hidden = st.ghostEnabled;
    };
    ghostBtn.onclick = async () => {
      const turnOn = !store.getState().settings.ghostEnabled;
      const ok = $("[data-ghost-ok]");
      if (turnOn && ok && !ok.checked) {
        store.toast("Pehle \"Samajh gaya, Ghost on karo\" par tick karein");
        ok.closest("label").classList.add("shake");
        setTimeout(() => ok.closest("label")?.classList.remove("shake"), 600);
        return;
      }
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
    $("#editPassword").addEventListener("input", (e) => ($(".current-pass").hidden = !e.target.value));

    // ---- security ----
    $("[data-action=lock-device]").onclick = () => {
      if (confirm("Is device se encryption key hata dein? Bean dobara kholne par password likhna hoga.")) store.lockThisDevice();
    };
    $("[data-action=logout-all]").onclick = () => {
      if (confirm("Har device se sign out karein (ye device bhi)?")) store.logoutAll();
    };
    const deviceList = $(".device-list");
    const loadDevices = async () => {
      try {
        const { sessions } = await api.sessions();
        deviceList.innerHTML = (sessions || [])
          .map((d) => `<div class="device-row"><span><strong>${escapeHtml(d.device)}</strong><small>${d.current ? "Ye device" : `Since ${new Date(d.createdAt).toLocaleDateString()}`}</small></span>${d.current ? "" : `<button type="button" class="link-btn" data-revoke="${escapeHtml(d.id)}">Log out</button>`}</div>`)
          .join("") || `<small class="set-note">No devices</small>`;
        deviceList.querySelectorAll("[data-revoke]").forEach((b) =>
          (b.onclick = async () => {
            b.disabled = true;
            try {
              await api.revokeSession(b.dataset.revoke);
              loadDevices();
            } catch (ex) {
              store.toast(ex.message);
            }
          })
        );
      } catch {
        deviceList.innerHTML = `<small class="set-note">Devices load nahi ho sake</small>`;
      }
    };
    loadDevices();
  };

  store.subscribe(render);
  render(store.getState());
}
