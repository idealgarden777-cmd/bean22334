import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { escapeHtml, formatDuration } from "../core/utils.js";
import { timerLabel } from "./settings-modal.js";
import { EMOJIS } from "../core/emoji.js";
import { emojiTag } from "../core/emoji-anim.js";

const MAX_CHARS = 2000;

const drafts = new Map();

function pickMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

export function mountComposer(container) {
  const convId = store.getState().activeId;

  container.innerHTML = `
    <form class="composer-form" autocomplete="off">
      <div class="composer-inner">
        <div class="timer-banner" hidden></div>
        <div class="compose-banner" hidden></div>
        <div class="emoji-picker" hidden>
          <label class="emoji-search">${icons.search}<input type="search" placeholder="Search emoji" aria-label="Search emoji"></label>
          <div class="emoji-grid"></div>
        </div>
        <div class="composer-pill-container">
          <span class="char-counter" aria-live="polite"></span>
          <button type="button" class="icon-btn attach-btn" title="Photo or file" aria-label="Attach">${icons.plus}</button>
          <input type="file" class="file-input" multiple hidden />
          <button type="button" class="icon-btn emoji-btn" title="Emoji" aria-label="Emoji">${icons.smile}</button>
          <textarea rows="1" placeholder="Message" aria-label="Message" maxlength="${MAX_CHARS}"></textarea>
          <div class="recording" hidden>
            <button type="button" class="icon-btn rec-cancel" aria-label="Cancel recording">${icons.trash}</button>
            <span class="rec-dot"></span><span class="rec-time">0:00</span>
            <span class="rec-label">Recording…</span>
          </div>
          <button type="button" class="round-btn mic-btn" title="Voice message" aria-label="Record voice message">${icons.mic}</button>
          <button type="submit" class="round-btn composer-send-btn" aria-label="Send" hidden>${icons.arrowUp}</button>
        </div>
      </div>
    </form>`;

  const form = container.querySelector("form");
  const input = container.querySelector("textarea");
  const sendBtn = container.querySelector(".composer-send-btn");
  const micBtn = container.querySelector(".mic-btn");
  const attachBtn = container.querySelector(".attach-btn");
  const fileInput = container.querySelector(".file-input");
  const banner = container.querySelector(".compose-banner");
  const recBox = container.querySelector(".recording");
  const recTime = container.querySelector(".rec-time");
  const counter = container.querySelector(".char-counter");
  const emojiBtn = container.querySelector(".emoji-btn");
  const picker = container.querySelector(".emoji-picker");
  const emojiGrid = container.querySelector(".emoji-grid");
  const emojiSearch = container.querySelector(".emoji-search input");
  const timerBanner = container.querySelector(".timer-banner");

  let recorder = null;
  let recStart = 0;
  let recTimer = null;
  let recChunks = [];
  let recCancelled = false;

  input.value = drafts.get(convId) || "";

  const paint = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 168) + "px";
    const hasText = Boolean(input.value.trim());
    const recording = Boolean(recorder);
    sendBtn.hidden = !(hasText || recording);
    micBtn.hidden = hasText || recording;
    input.hidden = recording;
    recBox.hidden = !recording;
    attachBtn.hidden = recording;
    emojiBtn.hidden = recording;
    const n = input.value.length;
    counter.textContent = `${n}/${MAX_CHARS}`;
    counter.classList.toggle("show", n >= MAX_CHARS * 0.75);
    counter.classList.toggle("full", n >= MAX_CHARS);
  };

  /* ----- emoji picker (with search) ----- */
  const paintEmoji = (q = "") => {
    const term = q.trim().toLowerCase();
    const list = term ? EMOJIS.filter(([, name]) => name.includes(term)) : EMOJIS;
    emojiGrid.innerHTML = list.length
      ? list.map(([e, name]) => `<button type="button" data-emoji="${e}" title="${name}">${emojiTag(e, "pick")}</button>`).join("")
      : `<p class="emoji-empty">No emoji found</p>`;
  };
  const togglePicker = (open = picker.hidden) => {
    picker.hidden = !open;
    emojiBtn.classList.toggle("on", open);
    if (open) {
      emojiSearch.value = "";
      paintEmoji();
      if (window.innerWidth > 767) emojiSearch.focus();
    }
  };
  emojiBtn.addEventListener("click", () => togglePicker());
  emojiSearch.addEventListener("input", () => paintEmoji(emojiSearch.value));
  emojiGrid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-emoji]");
    if (!b) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + b.dataset.emoji + input.value.slice(end);
    if (next.length > MAX_CHARS) return;
    input.value = next;
    input.selectionStart = input.selectionEnd = start + b.dataset.emoji.length;
    drafts.set(convId, input.value);
    paint();
  });
  const outside = (e) => {
    if (!picker.hidden && !picker.contains(e.target) && !emojiBtn.contains(e.target)) togglePicker(false);
  };
  document.addEventListener("pointerdown", outside, true);

  const submit = () => {
    if (recorder) return stopRecording(true);
    const text = input.value;
    if (!text.trim()) return;
    store.sendText(text);
    togglePicker(false);
    input.value = "";
    drafts.delete(convId);
    paint();
    input.focus();
  };

  input.addEventListener("input", () => {
    drafts.set(convId, input.value);
    paint();
    if (input.value.trim()) store.notifyTyping();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && window.innerWidth > 767) {
      e.preventDefault();
      submit();
    }
    if (e.key === "ArrowUp" && !input.value) {
      const s = store.getState();
      const mine = [...store.thread().items].reverse().find((m) => m.senderId === s.me.id && m.kind === "text" && !m.deletedAt && !m.pending);
      if (mine) {
        e.preventDefault();
        store.setEditing(mine);
      }
    }
  });
  input.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) {
      e.preventDefault();
      store.sendFiles(files);
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submit();
  });

  attachBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) store.sendFiles(fileInput.files);
    fileInput.value = "";
  });

  /* ----- voice notes ----- */
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return store.toast("Voice notes aren't supported in this browser");
    if (store.getState().call) return store.toast("Finish the call first");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return store.toast("Microphone permission was denied");
    }
    const mime = pickMime();
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recChunks = [];
    recCancelled = false;
    recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const duration = (Date.now() - recStart) / 1000;
      const blob = new Blob(recChunks, { type: recorder?.mimeType || mime || "audio/webm" });
      recorder = null;
      clearInterval(recTimer);
      paint();
      if (!recCancelled && duration >= 0.8 && blob.size) store.sendVoice(blob, Math.round(duration));
      else if (!recCancelled) store.toast("Hold on a little longer to record");
    };
    recorder.start(250);
    recStart = Date.now();
    recTime.textContent = "0:00";
    recTimer = setInterval(() => {
      const s = (Date.now() - recStart) / 1000;
      recTime.textContent = formatDuration(s);
      if (s >= 300) stopRecording(true); // 5 min cap
    }, 250);
    paint();
  }

  function stopRecording(send) {
    if (!recorder) return;
    recCancelled = !send;
    recorder.stop();
  }

  micBtn.addEventListener("click", startRecording);
  container.querySelector(".rec-cancel").addEventListener("click", () => stopRecording(false));

  /* ----- reply / edit banner ----- */
  let lastBanner = "";
  const renderBanner = (s) => {
    const conv = store.conversation();
    const target = s.editing || s.replyTo;
    const key = target ? `${s.editing ? "e" : "r"}:${target.id}` : "";
    if (key === lastBanner) return;
    const wasEditing = lastBanner.startsWith("e:");
    lastBanner = key;

    if (!target) {
      banner.hidden = true;
      banner.innerHTML = "";
      if (wasEditing) {
        input.value = drafts.get(convId) || "";
        paint();
      }
      return;
    }
    const preview =
      target.kind === "image" ? "📷 Photo" : target.kind === "audio" ? "🎤 Voice message" : target.kind === "file" ? `📎 ${target.attachment?.name || "File"}` : target.text;
    banner.hidden = false;
    banner.innerHTML = `
      <span class="banner-icon">${s.editing ? icons.edit : icons.reply}</span>
      <span class="banner-text">
        <strong>${s.editing ? "Editing message" : `Replying to ${escapeHtml(store.userName(target.senderId, conv))}`}</strong>
        <span>${escapeHtml(preview)}</span>
      </span>
      <button type="button" class="icon-btn" aria-label="Cancel">${icons.close}</button>`;
    banner.querySelector("button").onclick = () => store.cancelCompose();
    if (s.editing) {
      input.value = s.editing.text;
      paint();
    }
    input.focus();
  };

  /* ----- disappearing messages banner ----- */
  let lastTimer = null;
  const renderTimer = (s) => {
    if (s.settings.messageTimer === lastTimer) return;
    lastTimer = s.settings.messageTimer;
    timerBanner.hidden = !lastTimer;
    timerBanner.innerHTML = lastTimer
      ? `${icons.timer}<span>Disappearing messages are active · ${escapeHtml(timerLabel(lastTimer))}</span>`
      : "";
  };

  const unsub = store.subscribe((s) => {
    renderBanner(s);
    renderTimer(s);
  });
  renderBanner(store.getState());
  renderTimer(store.getState());
  paint();
  if (window.innerWidth > 767) input.focus();

  return () => {
    unsub();
    document.removeEventListener("pointerdown", outside, true);
    if (recorder) stopRecording(false);
  };
}
