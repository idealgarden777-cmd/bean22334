/* Bean Portal — the front door of bean.signaturesi.com */
import { api, ACCOUNTS_URL } from "../core/api.js";
import { avatar, escapeHtml } from "../core/utils.js";
import { icons } from "../components/icons.js";
import { logoMark } from "../components/logo.js";
import { isDark, toggleTheme } from "../core/theme.js";

const NEYO_URL = "https://neyo.signaturesi.com";

const APPS = [
  {
    id: "messenger",
    name: "Messenger",
    desc: "Chats, groups, voice notes and calls.",
    href: "/chat",
    icon: icons.chat,
    needsLogin: true,
  },
  {
    id: "beanbox",
    name: "Beanbox",
    desc: "Your files and media in one place.",
    href: null,
    soon: true,
    icon: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><line x1="12" y1="13" x2="12" y2="21"/></svg>`,
  },
  {
    id: "neyo",
    name: "Neyo",
    desc: "The Signaturesi AI, same Bean ID.",
    href: NEYO_URL,
    external: true,
    icon: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>`,
  },
  {
    id: "account",
    name: "Bean ID",
    desc: "Profile, password and sessions.",
    href: ACCOUNTS_URL,
    external: true,
    icon: `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function signInUrl(next = location.href) {
  return `${ACCOUNTS_URL}/?redirect=${encodeURIComponent(next)}`;
}

function appCard(app, user) {
  const locked = app.needsLogin && !user;
  const href = app.soon ? null : locked ? signInUrl(new URL(app.href, location.origin).href) : app.href;
  const tag = href ? "a" : "div";
  const attrs = href
    ? `href="${escapeHtml(href)}"${app.external ? ` target="_blank" rel="noopener"` : ""}`
    : `aria-disabled="true"`;
  const badge = app.soon
    ? `<span class="app-badge">Coming soon</span>`
    : locked
    ? `<span class="app-badge">Sign in</span>`
    : app.external
    ? `<span class="app-badge app-badge-ghost">↗</span>`
    : `<span class="app-badge app-badge-solid">Open</span>`;

  return `
    <${tag} class="app-card ${app.soon ? "is-soon" : ""}" ${attrs}>
      <span class="app-icon">${app.icon}</span>
      <span class="app-text">
        <strong>${app.name}</strong>
        <small>${app.desc}</small>
      </span>
      ${badge}
    </${tag}>`;
}

function render(root, user) {
  const hero = user
    ? `
      <div class="hero-user">
        ${avatar(user, "lg")}
        <div>
          <p class="hero-eyebrow">${greeting()}</p>
          <h1>${escapeHtml(user.displayName)}</h1>
          <p class="hero-id">${escapeHtml(user.beanId)}</p>
        </div>
      </div>
      <div class="hero-actions">
        <a class="btn-primary" href="/chat">Open Messenger</a>
        <button class="btn-ghost" type="button" data-action="logout">Sign out</button>
      </div>`
    : `
      <span class="hero-chip">${logoMark}<span>Bean by Signaturesi</span></span>
      <h1>One Bean ID.<br><span>Every Signaturesi app.</span></h1>
      <p class="hero-sub">Chat on Bean Messenger, keep files in Beanbox, and talk to Neyo, all with the same account.</p>
      <div class="hero-actions">
        <a class="btn-primary" href="${escapeHtml(signInUrl())}">Sign in with Bean ID</a>
        <a class="btn-ghost" href="${ACCOUNTS_URL}/?mode=register&redirect=${encodeURIComponent(location.href)}">Create Bean ID</a>
      </div>`;

  root.innerHTML = `
    <div class="portal">
      <header class="portal-top">
        <a class="portal-brand" href="/">${logoMark}<span>Bean</span></a>
        <div class="portal-top-right">
          <button type="button" class="icon-btn" data-action="theme" aria-label="Toggle theme">${isDark() ? icons.sun : icons.moon}</button>
        ${
          user
            ? `<a class="portal-me" href="${ACCOUNTS_URL}" target="_blank" rel="noopener">${avatar(user, "sm")}<span>${escapeHtml(
                user.username
              )}</span></a>`
            : `<a class="btn-ghost btn-sm" href="${escapeHtml(signInUrl())}">Sign in</a>`
        }
        </div>
      </header>

      <section class="portal-hero">${hero}</section>

      <section class="portal-apps" aria-label="Bean apps">
        <h2>Apps</h2>
        <div class="app-grid">${APPS.map((a) => appCard(a, user)).join("")}</div>
      </section>

      <footer class="portal-foot">
        <span>© ${new Date().getFullYear()} Signaturesi</span>
        <a href="${ACCOUNTS_URL}" target="_blank" rel="noopener">accounts.signaturesi.com</a>
      </footer>
    </div>`;

  const themeBtn = root.querySelector("[data-action=theme]");
  themeBtn.onclick = () => {
    toggleTheme();
    themeBtn.innerHTML = isDark() ? icons.sun : icons.moon;
  };

  const logout = root.querySelector("[data-action=logout]");
  if (logout) {
    logout.onclick = async () => {
      try {
        await api.logout();
      } catch {}
      render(root, null);
    };
  }
}

async function boot() {
  const root = document.getElementById("portal");
  root.innerHTML = `<div class="gate"><div class="spinner"></div></div>`;
  let user = null;
  try {
    const res = await api.me();
    if (res.authenticated) user = res.user;
  } catch {
    /* no API (local dev) or offline: show signed-out portal */
  }
  render(root, user);
}

document.addEventListener("DOMContentLoaded", boot);
