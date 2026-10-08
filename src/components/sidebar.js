import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml, formatListTime } from "../core/utils.js";
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
  container.innerHTML = `
    <div class="sidebar-header">
      <button type="button" class="me-row" data-action="settings" title="Settings">
        <span class="me-avatar"></span>
        <span class="profile-text">
          <strong class="me-name"></strong>
          <small class="me-id"></small>
        </span>
      </button>
      ${store.isDemo() ? `<span class="demo-badge" title="Local demo, no backend">Demo</span>` : ""}
      <button type="button" class="icon-btn" data-action="settings" title="Settings" aria-label="Settings">${icons.settings}</button>
      <button type="button" class="icon-btn icon-danger" data-action="logout" title="Sign out" aria-label="Sign out">${icons.power}</button>
    </div>

    <div class="sidebar-nav">
      <label class="search-pill">
        ${icons.search}
        <input type="search" placeholder="Search users..." aria-label="Search chats" />
      </label>
      <button type="button" class="new-message-btn" data-action="new">${icons.compose}<span>New Message</span></button>
      <div class="view-tabs" role="tablist">
        <button type="button" role="tab" data-view="home">Home</button>
        <button type="button" role="tab" data-view="beanbox">Beanbox <span class="tab-count"></span></button>
      </div>
    </div>

    <div class="notif-slot"></div>
    <nav class="chat-list" aria-label="Chats"></nav>
    <div class="people-results" hidden></div>`;

  const list = container.querySelector(".chat-list");
  const notifSlot = container.querySelector(".notif-slot");
  const tabs = container.querySelectorAll("[data-view]");
  const tabCount = container.querySelector(".tab-count");

  container.querySelector("[data-action=new]").onclick = () => store.openModal("new");
  container.querySelectorAll("[data-action=settings]").forEach((b) => (b.onclick = () => store.openModal("settings")));
  tabs.forEach((t) => (t.onclick = () => store.setView(t.dataset.view)));
  container.querySelector("[data-action=logout]").onclick = () => store.logout();
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

  let lastKey = "";
  let lastMe = "";
  const render = (s) => {
    const items = store.filteredConversations();
    const meKey = [s.me.displayName, s.me.avatarUrl].join("|");
    if (meKey !== lastMe) {
      lastMe = meKey;
      container.querySelector(".me-avatar").innerHTML = avatar(s.me, "sm");
      container.querySelector(".me-name").textContent = s.me.displayName;
      container.querySelector(".me-id").textContent = s.me.beanId;
    }
    const unreadChats = s.conversations.filter((c) => c.unread > 0 && c.id !== s.activeId).length;
    tabCount.textContent = unreadChats ? String(unreadChats) : "";
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === s.view));

    const key = JSON.stringify([
      s.activeId, s.search, s.notifPermission, s.view,
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
          ? `<p>No chats match your search.</p>`
          : s.view === "beanbox"
          ? "<p>Beanbox is clear. New messages you haven't read show up here.</p>"
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
