import { patchList } from "../core/dom.js";
import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml, formatListTime } from "../core/utils.js";
import { notificationsSupported } from "../core/notify.js";
import { logoMark } from "./logo.js";
import { emojify } from "../core/emoji-anim.js";
import { isDark, toggleTheme } from "../core/theme.js";

/* ---------- profile menu (opens from the profile bar) ---------- */
function closeProfileMenu() {
  document.querySelector(".profile-menu")?.remove();
  document.querySelector("[data-action=profile-menu]")?.setAttribute("aria-expanded", "false");
}

function openProfileMenu(anchor) {
  closeProfileMenu();
  const s = store.getState();
  const me = s.me;
  const menu = document.createElement("div");
  menu.className = "profile-menu";
  menu.setAttribute("role", "menu");
  menu.innerHTML = `
    <div class="pm-card">
      ${avatar(me, "lg")}
      <span class="pm-text">
        <strong>${escapeHtml(me.displayName)}</strong>
        <small>${escapeHtml(me.beanId)}</small>
        ${me.bio ? `<span class="pm-bio">${escapeHtml(me.bio)}</span>` : ""}
      </span>
    </div>
    ${s.settings.ghostEnabled ? `<div class="pm-status">👻 Ghost Mode is on</div>` : ""}
    <div class="pm-items">
      <button type="button" role="menuitem" data-pm="profile">${icons.user}<span>Edit profile</span></button>
      <button type="button" role="menuitem" data-pm="settings">${icons.settings}<span>Settings</span></button>
      <button type="button" role="menuitemcheckbox" aria-checked="${isDark()}" data-pm="theme">${icons.moon}<span>Dark mode</span><i class="switch ${isDark() ? "on" : ""}"></i></button>
      <button type="button" role="menuitem" data-pm="ghost">${icons.ghost}<span>${s.settings.ghostEnabled ? "Turn off Ghost Mode" : "Neyo Ghost"}</span></button>
    </div>
    <div class="pm-items pm-danger">
      <button type="button" role="menuitem" data-pm="logout">${icons.logout}<span>Sign out</span></button>
    </div>`;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, r.left)}px`;
  menu.style.width = `${Math.max(260, Math.min(r.width + 44, 300))}px`;
  menu.style.bottom = `${window.innerHeight - r.top + 8}px`;
  anchor.setAttribute("aria-expanded", "true");
  menu.querySelector("[data-pm]")?.focus({ preventScroll: true });

  menu.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pm]");
    if (!b) return;
    const act = b.dataset.pm;
    if (act === "theme") {
      toggleTheme();
      b.querySelector(".switch").classList.toggle("on", isDark());
      b.setAttribute("aria-checked", String(isDark()));
      return;
    }
    closeProfileMenu();
    if (act === "profile") store.openSettings("profile");
    if (act === "settings") store.openSettings("account");
    if (act === "ghost") {
      if (store.getState().settings.ghostEnabled) store.setGhost({ ghostEnabled: false }).catch((err) => store.toast(err.message));
      else store.openSettings("ghost");
    }
    if (act === "logout") store.logout();
  });
  const away = (e) => {
    if (menu.contains(e.target) || anchor.contains(e.target)) return;
    closeProfileMenu();
    document.removeEventListener("pointerdown", away, true);
    document.removeEventListener("keydown", esc, true);
  };
  const esc = (e) => {
    if (e.key !== "Escape") return;
    closeProfileMenu();
    anchor.focus();
    document.removeEventListener("pointerdown", away, true);
    document.removeEventListener("keydown", esc, true);
  };
  setTimeout(() => {
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc, true);
  });
}

function chatRow(c, state) {
  const me = state.me.id;
  const typing = (state.typing[c.id] || []).length > 0 && c.id === state.activeId;
  const prefix =
    c.lastSenderId === me ? "You: " : c.type === "group" && c.lastSenderId ? `${escapeHtml(store.userName(c.lastSenderId, c).split(" ")[0])}: ` : "";
  const preview = typing
    ? `<em class="typing-text">typing…</em>`
    : `${prefix}${escapeHtml((c.lastMessage && /^📎 voice-\d+\.(webm|m4a|mp4|ogg|aac)$/.test(c.lastMessage) ? "🎤 Voice message" : c.lastMessage) || (c.type === "group" ? `${c.members.length} members` : c.peer?.beanId || ""))}`;
  const unread = c.unread > 0 && c.id !== state.activeId;

  return `
    <button type="button" class="chat-item ${c.id === state.activeId ? "active" : ""} ${unread ? "has-unread" : ""}" data-id="${escapeHtml(c.id)}">
      ${avatar(c.type === "group" ? c : c.peer, "md", { online: c.peer?.online })}
      <span class="chat-info">
        <span class="chat-info-top">
          <strong>${escapeHtml(c.title)}${c.peer?.isBot ? ` <span class="ai-tag">AI</span>` : ""}</strong>
          <time>${formatListTime(c.updatedAt)}</time>
        </span>
        <span class="chat-info-bottom">
          <small>${typing ? preview : emojify(preview)}</small>
          ${c.muted ? `<span class="muted-icon" data-tip="Muted">${icons.bellOff}</span>` : ""}
          ${unread ? `<span class="unread-badge">${c.unread > 99 ? "99+" : c.unread}</span>` : ""}
        </span>
      </span>
    </button>`;
}

/* Neyo pinned on Home until the user has a chat with him */
function neyoRow(s) {
  if (s.view !== "home" || s.search || s.conversations.some((c) => c.peer?.username === "neyo")) return "";
  return `<button type="button" class="chat-item neyo-pin" data-neyo>
    ${avatar({ id: "neyo", displayName: "Neyo", avatarUrl: "/neyo-icon.png" }, "md", { online: true })}
    <span class="chat-info"><strong>Neyo <span class="ai-tag">AI</span></strong><small>Your AI: chat, reminders, Ghost Mode</small></span>
  </button>`;
}

export function mountSidebar(container) {
  container.innerHTML = `
    <div class="sidebar-header">
      <div class="brand">${logoMark}<span class="brand-name">Bean</span></div>
      ${store.isDemo() ? `<span class="demo-badge" data-tip="Local demo, no backend">Demo</span>` : ""}
      <button type="button" class="icon-btn header-new" data-action="new" data-tip="New chat" aria-label="New chat">${icons.compose}</button>
    </div>

    <div class="sidebar-nav">
      <label class="search-pill">
        ${icons.search}
        <input type="search" placeholder="Search chats or Bean IDs" aria-label="Search chats or Bean IDs" />
      </label>
      <div class="view-tabs" role="tablist">
        <button type="button" role="tab" data-view="home">All chats</button>
        <button type="button" role="tab" data-view="beanbox">Unread <span class="tab-count"></span></button>
      </div>
    </div>

    <div class="notif-slot"></div>
    <nav class="chat-list" aria-label="Chats"></nav>
    <div class="people-results" hidden></div>

    <div class="sidebar-footer">
      <button type="button" class="profile-bar" data-action="profile-menu" aria-haspopup="menu" aria-expanded="false">
        <span class="me-avatar"></span>
        <span class="profile-text"><strong class="me-name"></strong><small class="me-id"></small></span>
        <span class="profile-chevron">${icons.chevronUp}</span>
      </button>
      <button type="button" class="icon-btn" data-action="settings" data-tip="Settings" aria-label="Settings">${icons.settings}</button>
    </div>`;

  const list = container.querySelector(".chat-list");
  const notifSlot = container.querySelector(".notif-slot");
  const tabs = container.querySelectorAll("[data-view]");
  const tabCount = container.querySelector(".tab-count");

  container.querySelector("[data-action=new]").onclick = () => store.openModal("new");
  container.querySelector("[data-action=settings]").onclick = () => store.openSettings("profile");
  tabs.forEach((t) => (t.onclick = () => store.setView(t.dataset.view)));
  const profileBtn = container.querySelector("[data-action=profile-menu]");
  profileBtn.onclick = () => (document.querySelector(".profile-menu") ? closeProfileMenu() : openProfileMenu(profileBtn));
  const searchInput = container.querySelector(".search-pill input");
  const people = container.querySelector(".people-results");

  // Search box also finds Bean IDs (people you have no chat with yet)
  let peopleSeq = 0;
  let peopleTimer;
  const findPeople = (raw) => {
    clearTimeout(peopleTimer);
    const q = raw.trim();
    if (q.replace(/^@/, "").replace(/@bean$/i, "").length < 2) {
      people.hidden = true;
      people.innerHTML = "";
      return;
    }
    const seq = ++peopleSeq;
    peopleTimer = setTimeout(async () => {
      let users = [];
      try {
        users = await store.searchUsers(q);
      } catch {}
      if (seq !== peopleSeq) return;
      people.hidden = false;
      people.innerHTML = `<p class="people-title">People</p>${
        users.length
          ? users
              .map(
                (u) => `<button type="button" class="chat-item" data-username="${escapeHtml(u.username)}">
                  ${avatar(u, "md", { online: u.online })}
                  <span class="chat-info"><strong>${escapeHtml(u.displayName)}</strong><small>${escapeHtml(u.beanId)}</small></span>
                </button>`
              )
              .join("")
          : `<p class="muted-note">No Bean ID found for “${escapeHtml(q)}”.</p>`
      }`;
    }, 220);
  };
  people.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-username]");
    if (!b) return;
    b.disabled = true;
    try {
      await store.openDm(b.dataset.username);
      searchInput.value = "";
      store.setSearch("");
      findPeople("");
    } catch (err) {
      b.disabled = false;
      store.toast(err.message || "Could not open chat");
    }
  });
  searchInput.addEventListener("input", (e) => {
    store.setSearch(e.target.value);
    findPeople(e.target.value);
  });
  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-id]");
    if (item) store.selectConversation(item.dataset.id);
  });

  let listNodes = new Map();
  let lastKey = "";
  let lastMe = "";
  const render = (s) => {
    const items = store.filteredConversations();
    const meKey = [s.me.displayName, s.me.avatarUrl, s.me.bio].join("|");
    if (meKey !== lastMe) {
      lastMe = meKey;
      container.querySelector(".me-avatar").innerHTML = avatar(s.me, "sm", { online: true });
      container.querySelector(".me-name").textContent = s.me.displayName;
      container.querySelector(".me-id").textContent = s.me.beanId;
    }
    const unreadChats = s.conversations.filter((c) => c.unread > 0 && c.id !== s.activeId).length;
    tabCount.textContent = unreadChats ? String(unreadChats) : "";
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === s.view));

    const key = JSON.stringify([
      s.activeId, s.search, s.notifPermission, s.view, s.settings.ghostEnabled, s.settings.ghostUntil,
      items.map((c) => [c.id, c.updatedAt, c.lastMessage, c.unread, c.muted, c.title, c.peer?.online]),
      s.activeId ? s.typing[s.activeId] : null,
    ]);
    if (key === lastKey) return;
    lastKey = key;

    const until = s.settings.ghostUntil ? new Date(s.settings.ghostUntil) : null;
    notifSlot.innerHTML = s.settings.ghostEnabled
      ? `<div class="ghost-banner"><span>👻 <strong>Ghost Mode on</strong><small>${until ? `Until ${until.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Ghost replies to your DMs"}</small></span><button type="button" class="btn-primary btn-sm" data-ghost-off>I'm back</button></div>`
      : notificationsSupported() && s.notifPermission === "default"
      ? `<button type="button" class="notif-banner">${icons.bell}<span>Turn on notifications</span></button>`
      : "";
    const ghostOff = notifSlot.querySelector("[data-ghost-off]");
    if (ghostOff) ghostOff.onclick = () => store.setGhost({ ghostEnabled: false }).catch((err) => store.toast(err.message));
    const banner = notifSlot.querySelector(".notif-banner");
    if (banner) banner.onclick = () => store.enableNotifications();

    if (!items.length) {
      list.innerHTML = `<div class="chat-list-empty">${
        s.search
          ? `<p>No chats match your search.</p>`
          : s.view === "beanbox"
          ? "<p>You're all caught up. Unread chats show up here.</p>"
          : `<p>No chats yet.</p><button type="button" class="btn-primary btn-sm" data-empty-new>Start a chat</button>`
      }</div>`;
      const btn = list.querySelector("[data-empty-new]");
      if (btn) btn.onclick = () => store.openModal("new");
      const pin = neyoRow(s);
      if (pin) {
        list.insertAdjacentHTML("afterbegin", pin);
        list.querySelector("[data-neyo]").onclick = () => store.openNeyo();
      }
      listNodes = new Map();
      return;
    }
    // patch only the rows that changed (no flicker of avatars while chatting)
    const parts = [];
    const pinRow = neyoRow(s);
    if (pinRow) parts.push({ key: "neyo", html: pinRow });
    for (const c of items) parts.push({ key: c.id, html: chatRow(c, s) });
    if (list.querySelector(".chat-list-empty")) list.textContent = "";
    listNodes = patchList(list, listNodes, parts, false);
    const ny = list.querySelector("[data-neyo]");
    if (ny) ny.onclick = () => store.openNeyo();
  };

  store.subscribe(render);
  render(store.getState());
  setInterval(() => {
    lastKey = "";
    render(store.getState());
  }, 60000); // refresh relative times
}
