export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Escaped text with clickable links. */
export function richText(value) {
  return escapeHtml(value).replace(
    /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi,
    (url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    }
  );
}

export function isEmojiOnly(text) {
  const t = String(text || "").trim();
  return t.length > 0 && t.length <= 12 && /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u.test(t) && !/^[\d#*\s]+$/.test(t);
}

export function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

const AVATAR_TONES = ["#171717", "#3a3a3a", "#5b5b5b", "#0f8f66", "#3377e8", "#7660e8"];

export function toneFor(seed) {
  let hash = 0;
  for (const ch of String(seed || "?")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/* Avatar for a user, or for a group: { displayName, id } or { title, id, type: "group" } */
export function avatar(entity, size = "md", { online = false } = {}) {
  const name = entity?.displayName || entity?.title || entity?.username || "?";
  const group = entity?.type === "group";
  const inner = group
    ? `<svg viewBox="0 0 24 24" width="45%" height="45%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    : escapeHtml(initials(name));
  return `<span class="avatar avatar-${size}${group ? " avatar-group" : ""}" style="--avatar-tone:${toneFor(entity?.id || name)}" aria-hidden="true">${inner}${
    online ? `<i class="presence-dot"></i>` : ""
  }</span>`;
}

export function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();

export function formatListTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return formatTime(iso);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  if (now - d < 6 * 864e5) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function formatDay(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export function lastSeen(user) {
  if (!user) return "";
  if (user.online) return "Online";
  if (!user.lastSeenAt) return user.beanId || "";
  const diff = Date.now() - new Date(user.lastSeenAt).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "Last seen just now";
  if (min < 60) return `Last seen ${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `Last seen ${h}h ago`;
  return `Last seen ${formatListTime(user.lastSeenAt)}`;
}

export function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
