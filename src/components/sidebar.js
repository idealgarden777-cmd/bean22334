import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { logoMark } from "./logo.js";
import { avatar, escapeHtml, formatListTime } from "../core/utils.js";
import { isDark, toggleTheme } from "../core/theme.js";
import { notificationsSupported } from "../core/notify.js";

function chatRow(c, state) {
  const me = state.me.id;
  const typing = (state.typing[c.id] || []).length > 0 && c.id === state.activeId;
  const prefix =
    c.lastSenderId === me ? "You: " : c.type === "group" && c.lastSenderId ? `${escapeHtml(store.userName(c.lastSenderId, c).split(" ")[0])}: ` : "";
  const preview = typing
    ? `<em class="typing-text">typing…</em>`
    : `${prefix}${escapeHtml(c.lastMessage || (c.type === "group" ? `${c.members.length} members` : c.peer?.beanId || ""))}`;
  const unread = c.unread > 0 && c.id !== state.activeId;

  return `
    <button type="button" class="chat-item ${c.id === state.activeId ? "active" : ""} ${unread ? "has-unread" : ""}" data-id="${escapeHtml(c.id)}">
      ${avatar(c.type === "group" ? c : c.peer, "md", { online: c.peer?.online })}
      <span class="chat-info">
        <span class="chat-info-top">
          <strong>${escapeHtml(c.title)}</strong>
          <time>${formatListTime(c.updatedAt)}</time>
        </span>
        <span class="chat-info-bottom">
          <small>${preview}</small>
          ${c.muted ? `<span class="muted-icon" title="Muted">${icons.bellOff}</span>` : ""}
          ${unread ? `<span class="unread-badge">${c.unread > 99 ? "99+" : c.unread}</span>` : ""}
        </span>
      </span>
    </button>`;
}

export function mountSidebar(container) {
  const { me } = store.getState();

  container.innerHTML = `
    <div class="sidebar-header">
      <a class="brand" href="/" title="Bean portal">${logoMark}<span class="brand-name">Bean</span></a>
      ${store.isDemo() ? `<span class="demo-badge" title="Local demo, no backend">Demo</span>` : ""}
      <button type="button" class="icon-btn header-new" data-action="new" title="New chat" aria-label="New chat">${icons.compose}</button>
    </div>

    <div class="sidebar-nav">
      <label class="search-pill">
        ${icons.search}
        <input type="search" placeholder="Search" aria-label="Search chats" />
      </label>
    </div>

    <div class="notif-slot"></div>
    <nav class="chat-list" aria-label="Chats"></nav>

    <div class="sidebar-footer">
      <a class="profile-row" href="https://accounts.signaturesi.com" target="_blank" rel="noopener" title="Manage Bean ID">
        ${avatar(me, "sm")}
        <span class="profile-text">
          <strong>${escapeHtml(me.displayName)}</strong>
          <small>${escapeHtml(me.beanId)}</small>
        </span>
      </a>
      <button type="button" class="icon-btn" data-action="theme" aria-label="Toggle theme"></button>
      <button type="button" class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out">${icons.logout}</button>
    </div>`;

  const list = container.querySelector(".chat-list");
  const notifSlot = container.querySelector(".notif-slot");
  const themeBtn = container.querySelector("[data-action=theme]");

  const paintTheme = () => {
    themeBtn.innerHTML = isDark() ? icons.sun : icons.moon;
    themeBtn.title = isDark() ? "Light mode" : "Dark mode";
  };
  paintTheme();
  themeBtn.onclick = () => {
    toggleTheme();
    paintTheme();
  };

  container.querySelector("[data-action=new]").onclick = () => store.openModal("new");
  container.querySelector("[data-action=logout]").onclick = () => store.logout();
  container.querySelector(".search-pill input").addEventListener("input", (e) => store.setSearch(e.target.value));
  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-id]");
    if (item) store.selectConversation(item.dataset.id);
  });

  let lastKey = "";
  const render = (s) => {
    const items = store.filteredConversations();
    const key = JSON.stringify([
      s.activeId, s.search, s.notifPermission,
      items.map((c) => [c.id, c.updatedAt, c.lastMessage, c.unread, c.muted, c.title, c.peer?.online]),
      s.activeId ? s.typing[s.activeId] : null,
    ]);
    if (key === lastKey) return;
    lastKey = key;

    notifSlot.innerHTML =
      notificationsSupported() && s.notifPermission === "default"
        ? `<button type="button" class="notif-banner">${icons.bell}<span>Turn on notifications</span></button>`
        : "";
    const banner = notifSlot.querySelector(".notif-banner");
    if (banner) banner.onclick = () => store.enableNotifications();

    if (!items.length) {
      list.innerHTML = `<div class="chat-list-empty">${
        s.search
          ? "No chats match your search."
          : `<p>No chats yet.</p><button type="button" class="btn-primary btn-sm" data-empty-new>Start a chat</button>`
      }</div>`;
      const btn = list.querySelector("[data-empty-new]");
      if (btn) btn.onclick = () => store.openModal("new");
      return;
    }
    list.innerHTML = items.map((c) => chatRow(c, s)).join("");
  };

  store.subscribe(render);
  render(store.getState());
  setInterval(() => {
    lastKey = "";
    render(store.getState());
  }, 60000); // refresh relative times
}
