import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { logoMark } from "./logo.js";
import { avatar, escapeHtml } from "../core/utils.js";
import { isDark, toggleTheme } from "../core/theme.js";
import { mountChatList } from "./chat-list.js";

export function mountSidebar(container) {
  const { me, mode } = store.getState();

  container.innerHTML = `
    <div class="sidebar-header">
      <a class="brand" href="/" title="Bean portal">
        ${logoMark}
        <span class="brand-name">Bean</span>
        ${mode === "demo" ? `<span class="demo-badge" title="Local demo, no backend">Demo</span>` : ""}
      </a>
    </div>

    <div class="sidebar-nav">
      <button type="button" class="nav-row" data-action="new">
        <span class="nav-icon">${icons.compose}</span>
        <span>New chat</span>
      </button>
      <label class="search-pill">
        ${icons.search}
        <input type="search" placeholder="Search" aria-label="Search chats" />
      </label>
    </div>

    <div class="sidebar-label">Chats</div>
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
    </div>
  `;

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

  container.querySelector("[data-action=new]").onclick = () => store.toggleNewChat(true);
  container.querySelector("[data-action=logout]").onclick = () => store.logout();
  container.querySelector(".search-pill input").addEventListener("input", (e) => store.setSearch(e.target.value));

  mountChatList(container.querySelector(".chat-list"));
}
