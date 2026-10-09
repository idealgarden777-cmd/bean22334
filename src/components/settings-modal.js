/* Settings: one sheet with tabs.
 * Profile · Account · Neyo Ghost · Chats · Appearance
 * Desktop: tabs on the left. Phone: tabs scroll along the top. */
import { store } from "../core/store.js";
import { api } from "../core/api.js";
import { icons } from "./icons.js";
import { confirmDialog } from "./dialog.js";
import { avatar, escapeHtml } from "../core/utils.js";
import { isDark, toggleTheme } from "../core/theme.js";
import { notificationsSupported } from "../core/notify.js";

export const TIMERS = [
  { value: 0, label: "Off (keep forever)", short: "Off" },
  { value: 86400, label: "24 hours", short: "24h" },
  { value: 604800, label: "7 days", short: "7d" },
  { value: 2592000, label: "30 days", short: "30d" },
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
  { value: 1, label: "1 hour" },
  { value: 3, label: "3 hours" },
  { value: 8, label: "8 hours" },
];

const TABS = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "account", label: "Account & security", icon: "shield" },
  { id: "ghost", label: "Neyo Ghost", icon: "ghost" },
  { id: "chats", label: "Chats", icon: "chat" },
  { id: "appearance", label: "Appearance", icon: "sun" },
];

const TAB_ICONS = {
  user: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
  ghost: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V10a7 7 0 0 1 14 0v10l-2.5-2-2.3 2-2.2-2-2.2 2-2.3-2z"/><circle cx="9.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="14.5" cy="10.5" r=".8" fill="currentColor"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
};

const ghostNoteText = (s) =>
  s.ghostEnabled
    ? `On${s.ghostUntil ? ` until ${new Date(s.ghostUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}. Simple messages get a 👻 Ghost reply; money, plans and private things wait for you.`
    : "When you turn it off, Neyo sends you a handoff report.";

export function timerLabel(seconds) {
  return TIMERS.find((t) => t.value === Number(seconds))?.label || "Off (keep forever)";
}

/* resize a picked photo to a 320px square (centre crop), JPEG ~ 20-40 KB */
async function squarePhoto(file, size = 320) {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type)) throw new Error("Please choose a photo (JPG, PNG or WebP)");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is too large (max 15 MB)");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This photo can't be opened. Try a JPG or PNG.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  for (const q of [0.86, 0.75, 0.6]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length < 250 * 1024) return url;
  }
  throw new Error("Photo is still too large after resizing");
}

const profileTab = (me) => `
  <section class="set-panel" data-panel="profile">
    <header class="set-panel-head"><h3>Profile</h3><p>How people see you on Bean.</p></header>
    <div class="profile-card">
      <div class="profile-photo">
        <span class="profile-photo-av">${avatar(me, "xxl")}</span>
        <button type="button" class="photo-btn" data-photo-pick aria-label="Change photo">${TAB_ICONS.camera}</button>
        <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input hidden>
      </div>
      <div class="profile-card-text">
        <strong>${escapeHtml(me.displayName || me.username || "")}</strong>
        <small>${escapeHtml(me.beanId || (me.username ? `${me.username}@bean` : ""))}</small>
      <div class="profile-photo-actions">
        <button type="button" class="btn-soft btn-sm" data-photo-pick>Change photo</button>
        ${me.avatarUrl ? `<button type="button" class="btn-ghost btn-sm" data-photo-remove>Remove</button>` : ""}
      </div>
      </div>
    </div>
    <form class="set-form" data-form="profile" autocomplete="off">
      <label class="field">
        <span class="field-label">Display name</span>
        <input class="field-input" name="displayName" type="text" maxlength="40" value="${escapeHtml(me.displayName)}" required>
      </label>
      <label class="field">
        <span class="field-label">About <small class="field-count" data-bio-count>${(me.bio || "").length}/160</small></span>
        <textarea class="field-input" name="bio" rows="3" maxlength="160" placeholder="A few words about you">${escapeHtml(me.bio || "")}</textarea>
      </label>
      <div class="field">
        <span class="field-label">Bean ID</span>
        <div class="field-static"><span>${escapeHtml(me.beanId)}</span><button type="button" class="btn-ghost btn-xs" data-copy-id>Copy</button></div>
        <small class="field-hint">Your Bean ID can't be changed. Share it so people can find you.</small>
      </div>
      <p class="form-error" hidden></p>
      <div class="form-actions"><button type="submit" class="btn-primary" disabled>Save changes</button></div>
    </form>
  </section>`;

const accountTab = () => `
  <section class="set-panel" data-panel="account">
    <header class="set-panel-head"><h3>Account & security</h3><p>Password and the devices signed in to your account.</p></header>
    <form class="set-form card" data-form="password" autocomplete="off">
      <h4 class="card-title">Change password</h4>
      <label class="field"><span class="field-label">Current password</span><input class="field-input" name="current" type="password" autocomplete="current-password" maxlength="100" required></label>
      <label class="field"><span class="field-label">New password</span><input class="field-input" name="next" type="password" autocomplete="new-password" minlength="10" maxlength="100" placeholder="At least 10 characters" required></label>
      <small class="field-hint">Changing your password signs out every other device.</small>
      <p class="form-error" hidden></p>
      <div class="form-actions"><button type="submit" class="btn-primary">Update password</button></div>
    </form>
    <div class="card">
      <h4 class="card-title">Devices</h4>
      <div class="device-list"><div class="skeleton-row"></div><div class="skeleton-row"></div></div>
      <button type="button" class="set-row danger" data-action="logout-all">${icons.logout}<span>Log out of all devices</span></button>
    </div>
  </section>`;

const ghostTab = (settings) => `
  <section class="set-panel" data-panel="ghost">
    <header class="set-panel-head"><h3>Neyo Ghost</h3><p>When you're away, Neyo can answer simple direct messages for you.</p></header>
    <div class="card">
      <button type="button" class="set-row toggle-row" data-action="ghost" role="switch" aria-checked="${settings.ghostEnabled}">
        <span class="row-icon ghost-icon">👻</span>
        <span class="row-text"><strong>Ghost Mode</strong><small data-ghost-note>${ghostNoteText(settings)}</small></span>
        <i class="switch ${settings.ghostEnabled ? "on" : ""}"></i>
      </button>
    </div>
    <div class="card">
      <label class="field">
        <span class="field-label">What Ghost can tell people</span>
        <textarea id="ghostNote" class="field-input" rows="2" maxlength="500" placeholder="e.g. In a meeting, free after 6 pm">${escapeHtml(settings.ghostNote || "")}</textarea>
      </label>
      <span class="field-label">Turn on for</span>
      <div class="segmented-row" role="radiogroup" aria-label="Ghost duration">
        ${GHOST_HOURS.map((h) => `<button type="button" role="radio" data-hours="${h.value}" class="${h.value === 0 ? "on" : ""}" aria-checked="${h.value === 0}">${h.label}</button>`).join("")}
      </div>
    </div>
    <p class="fine-print">While Ghost Mode is on, Neyo reads the direct messages you receive and replies on your behalf. Every Ghost reply is labelled 👻 Ghost.</p>
  </section>`;

const chatsTab = (settings) => `
  <section class="set-panel" data-panel="chats">
    <header class="set-panel-head"><h3>Chats</h3><p>Defaults for new messages and how your chats look.</p></header>
    <div class="card">
      <h4 class="card-title">Disappearing messages</h4>
      <div class="segmented-row" role="radiogroup" aria-label="Default message timer">
        ${TIMERS.map((t) => `<button type="button" role="radio" data-timer="${t.value}" class="${t.value === settings.messageTimer ? "on" : ""}" aria-checked="${t.value === settings.messageTimer}">${t.short}</button>`).join("")}
      </div>
      <small class="field-hint" data-timer-note>${settings.messageTimer ? `New messages you send disappear after ${timerLabel(settings.messageTimer).toLowerCase()}.` : "Messages are kept until you delete them."}</small>
    </div>
    <div class="card">
      <h4 class="card-title">Chat wallpaper</h4>
      <div class="wallpaper-grid">
        ${WALLPAPERS.map((w) => `<button type="button" class="wp wp-${w.id} ${w.id === settings.wallpaper ? "on" : ""}" data-wallpaper="${w.id}" aria-label="${w.label}"><span>${w.label}</span></button>`).join("")}
      </div>
    </div>
  </section>`;

const appearanceTab = (state) => `
  <section class="set-panel" data-panel="appearance">
    <header class="set-panel-head"><h3>Appearance</h3><p>Theme and notifications on this device.</p></header>
    <div class="card">
      <button type="button" class="set-row toggle-row" data-action="theme" role="switch" aria-checked="${isDark()}">
        <span class="row-icon">${icons.moon}</span><span class="row-text"><strong>Dark mode</strong><small>Easier on the eyes at night</small></span><i class="switch ${isDark() ? "on" : ""}"></i>
      </button>
      ${
        notificationsSupported()
          ? `<button type="button" class="set-row" data-action="notify">
              <span class="row-icon">${icons.bell}</span><span class="row-text"><strong>Notifications</strong><small>Alerts for new messages and calls</small></span>
              <span class="row-value">${state.notifPermission === "granted" ? "On" : state.notifPermission === "denied" ? "Blocked in browser" : "Turn on"}</span>
            </button>`
          : ""
      }
    </div>
  </section>`;

export function mountSettings(container) {
  let open = false;

  const render = (state) => {
    const want = state.modal === "settings";
    if (want === open) return;
    open = want;
    if (!open) return (container.innerHTML = "");

    const { me, settings } = state;
    let tab = TABS.some((t) => t.id === state.settingsTab) ? state.settingsTab : "profile";

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal settings-sheet" role="dialog" aria-modal="true" aria-label="Settings">
          <aside class="settings-nav">
            <div class="settings-nav-head">
              <h2 class="modal-title">Settings</h2>
              <button type="button" class="icon-btn only-mobile" data-close aria-label="Close">${icons.close}</button>
            </div>
            <div class="settings-me-mini">${avatar(me, "md")}<span><strong>${escapeHtml(me.displayName)}</strong><small>${escapeHtml(me.beanId)}</small></span></div>
            <nav class="settings-tabs" role="tablist">
              ${TABS.map((t) => `<button type="button" role="tab" data-tab="${t.id}" aria-selected="${t.id === tab}" class="${t.id === tab ? "active" : ""}">${TAB_ICONS[t.icon]}<span>${t.label}</span></button>`).join("")}
            </nav>
            <button type="button" class="settings-signout" data-action="logout">${icons.logout}<span>Sign out</span></button>
          </aside>
          <div class="settings-main">
            <button type="button" class="icon-btn settings-close only-desktop" data-close aria-label="Close">${icons.close}</button>
            ${profileTab(me)}${accountTab()}${ghostTab(settings)}${chatsTab(settings)}${appearanceTab(state)}
          </div>
        </div>
      </div>`;

    const $ = (sel) => container.querySelector(sel);
    const $$ = (sel) => container.querySelectorAll(sel);
    const close = () => store.closeModal();
    $$("[data-close]").forEach((b) => (b.onclick = close));
    $(".modal-backdrop").addEventListener("mousedown", (e) => e.target === e.currentTarget && close());
    container.querySelector(".modal").addEventListener("keydown", (e) => e.key === "Escape" && close());

    const showTab = (id) => {
      tab = id;
      $$("[data-tab]").forEach((b) => {
        const on = b.dataset.tab === id;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", String(on));
      });
      $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== id));
      $(".settings-main").scrollTop = 0;
      if (id === "account") loadDevices();
    };
    $$("[data-tab]").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

    const refreshMini = () => {
      const m = store.getState().me;
      $(".settings-me-mini").innerHTML = `${avatar(m, "md")}<span><strong>${escapeHtml(m.displayName)}</strong><small>${escapeHtml(m.beanId)}</small></span>`;
      $(".profile-photo-av").innerHTML = avatar(m, "xxl");
      const actions = $(".profile-photo-actions");
      const hasRemove = Boolean(actions.querySelector("[data-photo-remove]"));
      if (m.avatarUrl && !hasRemove) actions.insertAdjacentHTML("beforeend", `<button type="button" class="btn-ghost btn-sm" data-photo-remove>Remove</button>`);
      if (!m.avatarUrl && hasRemove) actions.querySelector("[data-photo-remove]").remove();
    };

    /* ---------- profile ---------- */
    const pForm = $("[data-form=profile]");
    const pSave = pForm.querySelector("[type=submit]");
    const pErr = pForm.querySelector(".form-error");
    const dirty = () => {
      const m = store.getState().me;
      const name = pForm.querySelector("[name=displayName]").value.trim();
      pSave.disabled = !name || (name === m.displayName && pForm.querySelector("[name=bio]").value.trim() === (m.bio || ""));
      $("[data-bio-count]").textContent = `${pForm.querySelector("[name=bio]").value.length}/160`;
    };
    pForm.addEventListener("input", dirty);
    pForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      pErr.hidden = true;
      const m = store.getState().me;
      const displayName = pForm.querySelector("[name=displayName]").value.trim();
      const bio = pForm.querySelector("[name=bio]").value.trim();
      if (!displayName) return Object.assign(pErr, { hidden: false, textContent: "Display name can't be empty" });
      pSave.disabled = true;
      pSave.classList.add("loading");
      try {
        if (displayName !== m.displayName) await store.updateSettings({ displayName });
        if (bio !== (m.bio || "")) await store.updateProfile({ bio });
        refreshMini();
        store.toast("Profile saved");
      } catch (err) {
        Object.assign(pErr, { hidden: false, textContent: err.message });
      } finally {
        pSave.classList.remove("loading");
        dirty();
      }
    });
    $("[data-copy-id]").onclick = async () => {
      try {
        await navigator.clipboard.writeText(store.getState().me.beanId);
        store.toast("Bean ID copied");
      } catch {
        store.toast(store.getState().me.beanId);
      }
    };

    const photoInput = $("[data-photo-input]");
    container.addEventListener("click", async (e) => {
      if (e.target.closest("[data-photo-pick]")) photoInput.click();
      if (e.target.closest("[data-photo-remove]")) {
        try {
          await store.updateProfile({ avatar: null });
          refreshMini();
          store.toast("Photo removed");
        } catch (err) {
          store.toast(err.message);
        }
      }
    });
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files?.[0];
      photoInput.value = "";
      if (!file) return;
      const card = $(".profile-photo");
      card.classList.add("loading");
      try {
        const dataUrl = await squarePhoto(file);
        await store.updateProfile({ avatar: dataUrl });
        refreshMini();
        store.toast("Photo updated");
      } catch (err) {
        store.toast(err.message || "Couldn't update photo");
      } finally {
        card.classList.remove("loading");
      }
    });

    /* ---------- password ---------- */
    const wForm = $("[data-form=password]");
    const wErr = wForm.querySelector(".form-error");
    wForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      wErr.hidden = true;
      const currentPassword = wForm.querySelector("[name=current]").value;
      const password = wForm.querySelector("[name=next]").value;
      if (password.length < 10) return Object.assign(wErr, { hidden: false, textContent: "New password must be at least 10 characters" });
      if (password === currentPassword) return Object.assign(wErr, { hidden: false, textContent: "New password must be different" });
      const btn = wForm.querySelector("[type=submit]");
      btn.disabled = true;
      try {
        await store.updateSettings({ password, currentPassword });
        wForm.reset();
        loadDevices();
        store.toast("Password updated. Other devices were signed out.");
      } catch (err) {
        Object.assign(wErr, { hidden: false, textContent: err.message });
      } finally {
        btn.disabled = false;
      }
    });

    $("[data-action=logout-all]").onclick = () => {
      confirmDialog({ title: "Sign out everywhere?", text: "Every device, including this one, will need to sign in again.", confirm: "Sign out all", danger: true }).then((ok) => ok && store.logoutAll());
    };
    const deviceList = $(".device-list");
    let devicesLoaded = false;
    async function loadDevices() {
      try {
        const { sessions } = await api.sessions();
        devicesLoaded = true;
        deviceList.innerHTML =
          (sessions || [])
            .map(
              (d) => `<div class="device-row">
                <span class="device-icon">${icons.monitor || TAB_ICONS.shield}</span>
                <span class="device-text"><strong>${escapeHtml(d.device)}</strong><small>${d.current ? `<b class="current-pill">This device</b>` : `Signed in ${new Date(d.createdAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`}</small></span>
                ${d.current ? "" : `<button type="button" class="btn-ghost btn-xs" data-revoke="${escapeHtml(d.id)}">Log out</button>`}
              </div>`
            )
            .join("") || `<small class="field-hint">No devices</small>`;
        deviceList.querySelectorAll("[data-revoke]").forEach(
          (b) =>
            (b.onclick = async () => {
              b.disabled = true;
              try {
                await api.revokeSession(b.dataset.revoke);
                loadDevices();
              } catch (ex) {
                store.toast(ex.message);
                b.disabled = false;
              }
            })
        );
      } catch {
        if (!devicesLoaded) deviceList.innerHTML = `<small class="field-hint">Couldn't load your devices. Please try again.</small>`;
      }
    }

    /* ---------- ghost ---------- */
    let ghostHours = 0;
    $$("[data-hours]").forEach((b) => {
      b.onclick = () => {
        ghostHours = Number(b.dataset.hours);
        $$("[data-hours]").forEach((x) => {
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
      $("[data-ghost-note]").textContent = ghostNoteText(st);
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
        store.toast("Ghost note saved");
      } catch (err) {
        store.toast(err.message);
      }
    });

    /* ---------- chats ---------- */
    $$("[data-timer]").forEach((b) => {
      b.onclick = async () => {
        const value = Number(b.dataset.timer);
        $$("[data-timer]").forEach((x) => {
          x.classList.toggle("on", x === b);
          x.setAttribute("aria-checked", String(x === b));
        });
        $("[data-timer-note]").textContent = value ? `New messages you send disappear after ${timerLabel(value).toLowerCase()}.` : "Messages are kept until you delete them.";
        try {
          await store.updateSettings({ messageTimer: value });
        } catch (err) {
          store.toast(err.message);
        }
      };
    });
    $$("[data-wallpaper]").forEach((b) => {
      b.onclick = async () => {
        $$("[data-wallpaper]").forEach((x) => x.classList.toggle("on", x === b));
        try {
          await store.updateSettings({ wallpaper: b.dataset.wallpaper });
        } catch (err) {
          store.toast(err.message);
        }
      };
    });

    /* ---------- appearance ---------- */
    $("[data-action=theme]").onclick = (e) => {
      toggleTheme();
      e.currentTarget.querySelector(".switch").classList.toggle("on", isDark());
      e.currentTarget.setAttribute("aria-checked", String(isDark()));
    };
    const notify = $("[data-action=notify]");
    if (notify) {
      notify.onclick = async () => {
        await store.enableNotifications();
        const p = store.getState().notifPermission;
        notify.querySelector(".row-value").textContent = p === "granted" ? "On" : p === "denied" ? "Blocked in browser" : "Turn on";
      };
    }
    $("[data-action=logout]").onclick = () => store.logout();

    showTab(tab);
  };

  store.subscribe(render);
  render(store.getState());
}
