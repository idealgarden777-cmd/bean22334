import { patchList } from "../core/dom.js";
import { emojify, emojiTag } from "../core/emoji-anim.js";
import { store } from "../core/store.js";
import { icons } from "./icons.js";
import {
  avatar, escapeHtml, richText, isEmojiOnly, formatTime, formatDay, formatBytes, formatDuration,
} from "../core/utils.js";
import { openLightbox } from "./lightbox.js";
import { toggleVoice, voiceStatus, onVoicePaint, seekVoice, cycleRate } from "../core/voice-player.js";
import { downloadFile } from "../core/media.js";

export const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
const GROUP_GAP_MS = 5 * 60 * 1000;

/* ---------- voice note player (shared, in-app) ---------- */
let voiceRoot = null;

function paintVoice() {
  const root = voiceRoot;
  if (!root) return;
  root.querySelectorAll(".voice-note.active").forEach((el) => {
    if (!voiceStatus(el.dataset.voice)) resetVoiceEl(el);
  });
  root.querySelectorAll("[data-voice]").forEach((el) => {
    const st = voiceStatus(el.dataset.voice);
    if (st) paintVoiceEl(el, st);
  });
}

function resetVoiceEl(el) {
  el.classList.remove("active", "playing", "loading");
  el.querySelector(".voice-btn").innerHTML = icons.play;
  el.querySelector(".voice-btn").setAttribute("aria-label", "Play voice message");
  el.style.setProperty("--p", "0");
  el.querySelectorAll(".voice-wave i.on").forEach((i) => i.classList.remove("on"));
  el.querySelector(".voice-time").textContent = formatDuration(el.dataset.duration);
}

function paintVoiceEl(el, st) {
  el.classList.add("active");
  el.classList.toggle("playing", st.playing);
  el.classList.toggle("loading", st.loading);
  const btn = el.querySelector(".voice-btn");
  const want = st.playing ? "pause" : "play";
  if (btn.dataset.icon !== want) {
    btn.dataset.icon = want;
    btn.innerHTML = st.playing ? icons.pause : icons.play;
    btn.setAttribute("aria-label", st.playing ? "Pause voice message" : "Play voice message");
  }
  const bars = el.querySelectorAll(".voice-wave i");
  const on = Math.round(st.progress * bars.length);
  bars.forEach((b, i) => b.classList.toggle("on", i < on));
  el.querySelector(".voice-time").textContent = st.time;
  const speed = el.querySelector(".voice-speed");
  if (speed) speed.textContent = `${st.rate}×`;
}

onVoicePaint(paintVoice);

/* ---------- pieces ---------- */

/* a stable, natural-looking waveform per message */
function waveFor(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const bars = [];
  for (let i = 0; i < 32; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    const env = Math.sin((Math.PI * (i + 1)) / 33);
    bars.push(Math.round(4 + (6 + r * 14) * (0.45 + 0.55 * env)));
  }
  return bars;
}

function attachmentHtml(m, upload) {
  const a = m.attachment;
  if (!a) return "";
  const progress = upload
    ? `<span class="upload-progress"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" pathLength="100" style="stroke-dashoffset:${100 - Math.round(upload.progress * 100)}"/></svg></span>`
    : "";

  if (m.kind === "image") {
    return `<button type="button" class="bubble-image" data-image="${escapeHtml(a.url || "")}" ${a.url ? "" : "disabled"}>
      ${a.url ? `<img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name || "Photo")}" loading="lazy" />` : `<span class="image-missing">${icons.image}</span>`}
      ${progress}
    </button>`;
  }
  if (m.kind === "audio") {
    const ready = a.url && !m.pending;
    return `<div class="voice-note" data-voice="${escapeHtml(m.id)}" data-url="${escapeHtml(a.url || "")}" data-mime="${escapeHtml(a.mime || "")}" data-duration="${a.duration || 0}">
      <button type="button" class="voice-btn" aria-label="Play voice message" ${ready ? "" : "disabled"}>${icons.play}</button>
      <span class="voice-body">
        <span class="voice-wave" role="slider" aria-label="Voice message position" aria-valuemin="0" aria-valuemax="100" tabindex="${ready ? 0 : -1}">${waveFor(m.id).map((h) => `<i style="height:${h}px"></i>`).join("")}</span>
        <span class="voice-foot"><span class="voice-time">${formatDuration(a.duration)}</span><button type="button" class="voice-speed" aria-label="Playback speed">1×</button></span>
      </span>
      ${progress}
    </div>`;
  }
  const ext = (String(a.name || "").split(".").pop() || "").slice(0, 4).toUpperCase();
  return `<button type="button" class="file-card" data-download ${a.url && !m.pending ? "" : "disabled"} data-tip="Save to device">
    <span class="file-icon">${icons.file}${ext && ext.length <= 4 ? `<em>${escapeHtml(ext)}</em>` : ""}</span>
    <span class="file-meta"><strong>${escapeHtml(a.name || "File")}</strong><small>${formatBytes(a.size)}</small></span>
    ${progress || `<span class="file-dl">${icons.download}</span>`}
  </button>`;
}

function statusHtml(m, state, conv, isLastOwn) {
  if (m.failed) return `<button type="button" class="message-retry" data-retry="${escapeHtml(m.id)}">Not sent · Retry</button>`;
  if (m.senderId !== state.me.id) return "";
  if (m.pending) return `<span class="msg-status">${icons.clock}</span>`;
  const reads = state.reads[conv.id] || {};
  const readers = conv.members.filter((u) => u.id !== state.me.id && reads[u.id] && reads[u.id] >= m.createdAt);
  const seen = conv.type === "dm" ? readers.length > 0 : readers.length > 0;
  return `<span class="msg-status ${seen ? "seen" : ""}" data-tip="${seen ? "Seen" : "Delivered"}">${icons.checks}</span>${
    isLastOwn && seen ? `<span class="seen-label">${conv.type === "dm" ? "Seen" : `Seen by ${readers.length}`}</span>` : ""
  }`;
}

function messageHtml(m, ctx) {
  const { state, conv, prev, next, lastOwnId } = ctx;
  const own = m.senderId === state.me.id;
  const group = conv.type === "group";

  if (m.kind === "system") {
    return `<div class="system-row" data-mid="${escapeHtml(m.id)}"><span>${escapeHtml(m.text)}</span></div>`;
  }
  if (m.kind === "call") {
    const missed = /missed|declined/i.test(m.text);
    return `<div class="system-row call-row ${missed ? "missed" : ""}" data-mid="${escapeHtml(m.id)}">
      <span>${m.text.toLowerCase().includes("video") ? icons.video : icons.phone} ${escapeHtml(m.text)} · ${formatTime(m.createdAt)}</span>
    </div>`;
  }

  const chained = (a, b) =>
    a && b && a.senderId === b.senderId && !["system", "call"].includes(a.kind) && Math.abs(new Date(b.createdAt) - new Date(a.createdAt)) < GROUP_GAP_MS && formatDay(a.createdAt) === formatDay(b.createdAt);
  const first = !chained(prev, m);
  const last = !chained(m, next);

  const deleted = Boolean(m.deletedAt);
  const emojiOnly = !deleted && m.kind === "text" && isEmojiOnly(m.text) && !m.replyTo;
  const upload = state.uploads.find((u) => u.id === m.id);

  const sender = group && !own && first ? `<span class="sender-name" style="color:var(--text-secondary)">${escapeHtml(store.userName(m.senderId, conv))}</span>` : "";
  const reply = m.replyTo
    ? `<button type="button" class="reply-quote" data-jump="${escapeHtml(m.replyTo.id)}">
        <strong>${escapeHtml(store.userName(m.replyTo.senderId, conv))}</strong>
        <span>${escapeHtml(m.replyTo.text || "Attachment")}</span>
      </button>`
    : "";
  const body = deleted
    ? `<span class="deleted-text">${own ? "You deleted this message" : "This message was deleted"}</span>`
    : `${attachmentHtml(m, upload)}${m.text ? `<span class="bubble-text">${emojify(richText(m.text), emojiOnly ? "big" : "inline")}</span>` : ""}`;

  const reactions = m.reactions?.length
    ? `<div class="reactions">${m.reactions
        .map(
          (r) =>
            `<button type="button" class="reaction-chip ${r.userIds.includes(state.me.id) ? "mine" : ""}" data-react="${escapeHtml(r.emoji)}" data-tip="${escapeHtml(
              r.userIds.map((u) => store.userName(u, conv)).join(", ")
            )}">${emojiTag(r.emoji, "react")}${r.userIds.length > 1 ? `<span>${r.userIds.length}</span>` : ""}</button>`
        )
        .join("")}</div>`
    : "";

  const media = !deleted && (m.kind === "image") && !m.text;
  const classes = [
    "message-row", own ? "own" : "other", first ? "first" : "", last ? "last" : "",
    m.pending ? "pending" : "", m.failed ? "failed" : "", emojiOnly ? "emoji-only" : "",
    deleted ? "deleted" : "", media ? "media-only" : "", `kind-${m.kind}`,
  ].join(" ");

  return `
    <div class="${classes}" data-mid="${escapeHtml(m.id)}">
      ${group && !own ? `<span class="row-avatar">${last ? avatar(conv.members.find((u) => u.id === m.senderId) || { displayName: "?" }, "sm") : ""}</span>` : ""}
      <div class="message-content">
        ${sender}
        <div class="bubble-wrap">
          <div class="message-bubble">
            ${reply}${body}
            <span class="bubble-meta">${m.ghost ? `<span class="ghost-tag" data-tip="Sent by Neyo Ghost while ${own ? "you were" : "they were"} away">👻 Ghost</span>` : ""}${m.expiresAt && !deleted ? `<span class="meta-timer" data-tip="Disappears ${escapeHtml(new Date(m.expiresAt).toLocaleString())}">${icons.timer}</span>` : ""}${m.editedAt && !deleted ? "<span>edited</span>" : ""}<time>${formatTime(m.createdAt)}</time>${statusHtml(m, state, conv, m.id === lastOwnId)}</span>
          </div>
          ${
            !deleted && !m.pending && !m.failed
              ? `<div class="msg-actions">
                  <button type="button" class="icon-btn" data-act="react" aria-label="React" data-tip="React">${icons.smile}</button>
                  <button type="button" class="icon-btn" data-act="reply" aria-label="Reply" data-tip="Reply">${icons.reply}</button>
                  <button type="button" class="icon-btn" data-act="more" aria-label="More" data-tip="More">${icons.more}</button>
                </div>`
              : ""
          }
        </div>
        ${reactions}
      </div>
    </div>`;
}

/* ---------- popup menu ---------- */

function closeMenu() {
  document.querySelector(".msg-menu")?.remove();
}

function openMenu(anchor, message, mode) {
  closeMenu();
  const state = store.getState();
  const own = message.senderId === state.me.id;
  const menu = document.createElement("div");
  menu.className = "msg-menu";
  menu.innerHTML = `
    <div class="menu-reactions">${QUICK_REACTIONS.map((e) => `<button type="button" data-emoji="${e}" aria-label="React ${e}">${emojiTag(e, "react")}</button>`).join("")}</div>
    ${
      mode === "more"
        ? `<div class="menu-items">
            <button type="button" data-item="reply">${icons.reply}<span>Reply</span></button>
            ${message.text ? `<button type="button" data-item="copy">${icons.copy}<span>Copy text</span></button>` : ""}
            ${message.attachment?.url ? `<button type="button" data-item="download">${icons.download}<span>Save to device</span></button>` : ""}
            ${own && message.kind === "text" ? `<button type="button" data-item="edit">${icons.edit}<span>Edit</span></button>` : ""}
            ${own ? `<button type="button" data-item="delete" class="danger">${icons.trash}<span>Unsend</span></button>` : ""}
          </div>`
        : ""
    }`;
  document.body.appendChild(menu);

  const r = anchor.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let left = own ? r.right - mw : r.left;
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
  let top = r.top - mh - 6;
  if (top < 8) top = r.bottom + 6;
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.min(top, window.innerHeight - mh - 8)}px`;

  menu.addEventListener("click", async (e) => {
    const emoji = e.target.closest("[data-emoji]")?.dataset.emoji;
    const item = e.target.closest("[data-item]")?.dataset.item;
    if (emoji) store.react(message.id, emoji);
    if (item === "reply") store.setReply(message);
    if (item === "edit") store.setEditing(message);
    if (item === "copy") navigator.clipboard?.writeText(message.text).then(() => store.toast("Copied"));
    if (item === "delete") store.unsend(message.id);
    if (item === "download") downloadFile(message.attachment?.url, message.attachment?.name);
    if (emoji || item) closeMenu();
  });
  setTimeout(() => {
    const away = (e) => {
      if (!menu.contains(e.target)) {
        closeMenu();
        document.removeEventListener("pointerdown", away, true);
      }
    };
    document.addEventListener("pointerdown", away, true);
  });
}

/* ---------- mount ---------- */

export function mountMessageList(container) {
  container.innerHTML = `
    <div class="message-scroll">
      <div class="message-list" role="log" aria-live="polite"></div>
    </div>
    <button type="button" class="jump-bottom" hidden aria-label="Scroll to latest">${icons.arrowDown}<span class="jump-count"></span></button>`;
  const scroller = container.querySelector(".message-scroll");
  const list = container.querySelector(".message-list");
  voiceRoot = list;
  const jump = container.querySelector(".jump-bottom");
  let lastKey = "";
  let lastCount = 0;
  let unseenBelow = 0;
  let firstPaint = true;
  let nodes = new Map(); // row key -> { html, el }
  let shownConv = null;

  const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140;
  const toBottom = (smooth = false) => scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" });

  const render = (state) => {
    const conv = store.conversation();
    if (!conv) return;
    const thread = store.thread();
    const typing = state.typing[conv.id] || [];
    const reads = state.reads[conv.id] || {};
    const key = JSON.stringify([
      conv.id, thread.loaded, thread.hasMore, thread.loading,
      thread.items.map((m) => [m.id, m.updatedAt, m.pending, m.failed, m.reactions?.length]),
      state.uploads.map((u) => [u.id, Math.round(u.progress * 20)]),
      typing, reads, conv.members.length, Object.keys(state.unsending),
      thread.items.filter((m) => m.expiresAt && m.expiresAt <= new Date().toISOString()).length,
    ]);
    scroller.dataset.wallpaper = state.settings.wallpaper || "none";
    if (key === lastKey) return;
    lastKey = key;

    const wasNear = nearBottom();
    const prevHeight = scroller.scrollHeight;
    const prevTop = scroller.scrollTop;
    const prepended = thread.items.length > lastCount && lastCount > 0 && thread.items[0]?.id !== list.querySelector("[data-mid]")?.dataset.mid && !wasNear;

    if (!thread.loaded) {
      list.innerHTML = `<div class="list-loading"><div class="spinner"></div></div>`;
      nodes = new Map();
      return;
    }
    const switched = shownConv !== conv.id;
    if (switched) {
      shownConv = conv.id;
      nodes = new Map();
      list.textContent = "";
    }

    const now = new Date().toISOString();
    const items = thread.items.filter((m) => !state.unsending[m.id] && !(m.expiresAt && m.expiresAt <= now));
    const lastOwn = [...items].reverse().find((m) => m.senderId === state.me.id && !m.pending && !m.deletedAt && !["system", "call"].includes(m.kind));
    const parts = [];
    if (thread.hasMore) {
      parts.push({ key: "older", html: `<div class="load-older">${thread.loading ? `<div class="spinner"></div>` : `<button type="button" data-older>Load earlier messages</button>`}</div>` });
    }
    if (!items.length) {
      parts.push({
        key: "empty",
        html: `<div class="message-empty">
        ${avatar(conv.type === "dm" ? conv.peer : conv, "lg")}
        <strong>${escapeHtml(conv.title)}</strong>
        <span>${conv.type === "dm" ? escapeHtml(conv.peer?.beanId || "") : `${conv.members.length} members`}</span>
        <p>No messages yet. Say hi 👋</p>
      </div>`,
      });
    }
    let lastDay = "";
    items.forEach((m, i) => {
      const day = formatDay(m.createdAt);
      if (day !== lastDay) parts.push({ key: `day:${day}`, html: `<div class="day-divider"><span>${day}</span></div>` });
      lastDay = day;
      parts.push({ key: `m:${m.localKey || m.id}`, msg: true, html: messageHtml(m, { state, conv, prev: items[i - 1], next: items[i + 1], lastOwnId: lastOwn?.id }) });
    });
    if (typing.length) {
      parts.push({
        key: "typing",
        html: `<div class="message-row other first last typing-row">
        ${conv.type === "group" ? `<span class="row-avatar"></span>` : ""}
        <div class="message-content"><div class="message-bubble typing-bubble"><i></i><i></i><i></i></div></div>
      </div>`,
      });
    }
    nodes = patchList(list, nodes, parts, !firstPaint && !switched && !prepended);
    paintVoice();

    const newCount = items.length;
    const lastMsg = items[items.length - 1];
    const grew = newCount > lastCount;
    if (firstPaint || switched) {
      toBottom();
      firstPaint = false;
    } else if (prepended) {
      scroller.scrollTop = prevTop + (scroller.scrollHeight - prevHeight);
    } else if (wasNear || (grew && lastMsg?.senderId === state.me.id)) {
      toBottom(true);
      unseenBelow = 0;
    } else if (grew) {
      unseenBelow += newCount - lastCount;
    }
    lastCount = newCount;
    paintJump();
  };

  const paintJump = () => {
    const show = !nearBottom();
    jump.hidden = !show;
    jump.querySelector(".jump-count").textContent = unseenBelow > 0 ? unseenBelow : "";
    if (!show) unseenBelow = 0;
  };

  scroller.addEventListener("scroll", () => {
    paintJump();
    if (scroller.scrollTop < 80) store.loadOlder();
  });
  jump.addEventListener("click", () => {
    unseenBelow = 0;
    toBottom(true);
  });

  list.addEventListener("click", (e) => {
    const target = e.target;
    if (target.closest("[data-older]")) return store.loadOlder();

    const retry = target.closest("[data-retry]");
    if (retry) return store.retry(retry.dataset.retry);

    const row = target.closest("[data-mid]");
    if (!row) return;
    const msg = store.thread().items.find((m) => m.id === row.dataset.mid);
    if (!msg) return;

    const jumpTo = target.closest("[data-jump]");
    if (jumpTo) {
      const el = list.querySelector(`[data-mid="${CSS.escape(jumpTo.dataset.jump)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 1200);
      } else store.toast("That message is further up");
      return;
    }
    const img = target.closest("[data-image]");
    if (img && img.dataset.image) return openLightbox(img.dataset.image, msg.attachment?.name);

    const box = target.closest("[data-voice]");
    if (box && box.dataset.url) {
      const info = { id: box.dataset.voice, url: box.dataset.url, mime: box.dataset.mime, duration: box.dataset.duration };
      if (target.closest(".voice-speed")) return cycleRate();
      const wave = target.closest(".voice-wave");
      if (wave) {
        const r = wave.getBoundingClientRect();
        const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        if (!voiceStatus(info.id)) toggleVoice(info);
        return seekVoice(info.id, f);
      }
      if (target.closest(".voice-btn")) return toggleVoice(info);
      return;
    }
    if (target.closest("[data-download]")) return downloadFile(msg.attachment?.url, msg.attachment?.name);
    const chip = target.closest("[data-react]");
    if (chip) return store.react(msg.id, chip.dataset.react);

    const act = target.closest("[data-act]")?.dataset.act;
    if (act === "reply") return store.setReply(msg);
    if (act === "react" || act === "more") return openMenu(target.closest("[data-act]"), msg, act);
  });

  // double-click / double-tap a bubble to ❤️
  list.addEventListener("dblclick", (e) => {
    const row = e.target.closest(".message-row[data-mid]");
    if (!row || e.target.closest("a, button, .voice-note")) return;
    const msg = store.thread().items.find((m) => m.id === row.dataset.mid);
    if (msg && !msg.deletedAt && !msg.pending) store.react(msg.id, "❤️");
  });

  // long-press on touch opens the menu
  let pressTimer;
  list.addEventListener("touchstart", (e) => {
    const bubble = e.target.closest(".message-bubble");
    const row = e.target.closest(".message-row[data-mid]");
    if (!bubble || !row) return;
    pressTimer = setTimeout(() => {
      const msg = store.thread().items.find((m) => m.id === row.dataset.mid);
      if (msg && !msg.deletedAt && !msg.pending) {
        navigator.vibrate?.(10);
        openMenu(bubble, msg, "more");
      }
    }, 450);
  }, { passive: true });
  ["touchend", "touchmove", "touchcancel"].forEach((ev) => list.addEventListener(ev, () => clearTimeout(pressTimer), { passive: true }));

  const unsub = store.subscribe(render);
  render(store.getState());
  // keyboard: arrows on the waveform skip 5s
  list.addEventListener("keydown", (e) => {
    const wave = e.target.closest?.(".voice-wave");
    if (!wave || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const box = wave.closest("[data-voice]");
    const st = voiceStatus(box.dataset.voice);
    if (!st || !st.total) return;
    e.preventDefault();
    seekVoice(box.dataset.voice, (st.current + (e.key === "ArrowRight" ? 5 : -5)) / st.total);
  });

  return () => {
    unsub();
    closeMenu();
    if (voiceRoot === list) voiceRoot = null;
  };
}
