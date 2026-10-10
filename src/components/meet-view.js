/* Bean Meet screen: join check -> lobby -> meeting -> ended.
 * Video tiles are long-lived DOM nodes (never re-created on updates), so video
 * never flickers; only labels, rings and the control bar update. */
import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml } from "../core/utils.js";
import { captionsSupported, screenShareSupported, CAPTION_LANGS, captionLang } from "../core/meet.js";
import { confirmDialog } from "./dialog.js";
import { selectHtml, bindSelect, closeSelect } from "./select.js";

const MEET_HOST = "bean.signaturesi.com";
const meetUrl = (code) => `https://${location.host === "localhost:4173" ? MEET_HOST : location.host}/meet/${code}`;

function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    store.toast("Meeting link copied");
  } catch {
    store.toast(text);
  }
}

export function mountMeetView(container) {
  let phase = null;
  let preview = null; // { stream, muted, cameraOff }
  let tiles = new Map();
  let panel = null; // "people" | "transcript" | null
  let menuOpen = false;
  let pinned = null;
  let clock = null;
  let ringTimer = null;
  let barKey = "";

  const stopPreview = () => {
    preview?.stream?.getTracks().forEach((t) => t.stop());
    preview = null;
  };

  const cleanup = () => {
    clearInterval(clock);
    clearInterval(ringTimer);
    tiles = new Map();
    barKey = "";
    menuOpen = false;
  };

  /* ---------- join check (pre-join) ---------- */

  async function getPreview() {
    if (preview) return preview.ready;
    const pv = (preview = { stream: null, muted: false, cameraOff: false, error: null });
    pv.ready = acquire(pv).then(() => {
      // closed while the browser was still asking: release the camera
      if (preview !== pv) pv.stream?.getTracks().forEach((t) => t.stop());
      return pv;
    });
    return pv.ready;
  }

  async function acquire(preview) {
    try {
      preview.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
    } catch {
      try {
        preview.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        preview.cameraOff = true;
        preview.error = "No camera — you'll join with audio only";
      } catch {
        preview.muted = true;
        preview.cameraOff = true;
        preview.error = "No camera or microphone allowed — you can still watch and listen";
      }
    }
  }

  function renderPrejoin(m) {
    const p = m.preview;
    const mt = p.meeting;
    const host = mt.host;
    const people = p.people || [];
    container.innerHTML = `
      <div class="meet-screen meet-prejoin">
        <div class="meet-pre-wrap">
          <div class="meet-pre-video">
            <video autoplay playsinline muted class="mirror"></video>
            <div class="meet-pre-off">${avatar(store.getState().me, "xxl")}<span>Camera is off</span></div>
            <div class="meet-pre-tools">
              <button type="button" class="meet-btn" data-pre="mic" aria-label="Microphone"></button>
              <button type="button" class="meet-btn" data-pre="cam" aria-label="Camera"></button>
            </div>
            <p class="meet-pre-note" hidden></p>
          </div>
          <div class="meet-pre-card">
            <span class="meet-verified">${icons.shield} Real Bean meeting · ${escapeHtml(location.host || MEET_HOST)}</span>
            <h1>${escapeHtml(mt.title)}</h1>
            <p class="meet-code">${escapeHtml(mt.code)}${mt.chatTitle ? ` · ${escapeHtml(mt.chatTitle)}` : ""}</p>
            <div class="meet-host">
              ${avatar(host, "md")}
              <span><strong>${escapeHtml(host?.displayName || "Bean user")}</strong><small>@${escapeHtml(host?.username || "")} · host</small></span>
            </div>
            <p class="meet-inside">${
              people.length
                ? `${people.slice(0, 3).map((u) => escapeHtml(u.displayName.split(" ")[0])).join(", ")}${people.length > 3 ? ` and ${people.length - 3} more` : ""} ${people.length === 1 ? "is" : "are"} in the meeting`
                : "No one else is here yet"
            }</p>
            ${p.full ? `<p class="meet-warn">This meeting is full.</p>` : ""}
            <button type="button" class="btn-primary meet-join" data-join ${p.full ? "disabled" : ""}>${p.direct ? "Join now" : "Ask to join"}</button>
            ${p.direct ? "" : `<p class="meet-fine">Someone in the meeting will see your Bean ID and let you in.</p>`}
            <button type="button" class="meet-link-btn" data-cancel>Back to chats</button>
            <p class="meet-fine safety">Bean never asks for your password inside a meeting. Meeting links always start with ${escapeHtml(location.host || MEET_HOST)}/meet/.</p>
          </div>
        </div>
      </div>`;

    const video = container.querySelector(".meet-pre-video video");
    const note = container.querySelector(".meet-pre-note");
    const mic = container.querySelector('[data-pre="mic"]');
    const cam = container.querySelector('[data-pre="cam"]');
    const paint = () => {
      if (!preview) return;
      mic.innerHTML = preview.muted ? icons.micOff : icons.mic;
      cam.innerHTML = preview.cameraOff ? icons.videoOff : icons.video;
      mic.classList.toggle("off", preview.muted);
      cam.classList.toggle("off", preview.cameraOff);
      mic.dataset.tip = preview.muted ? "Turn on microphone" : "Turn off microphone";
      cam.dataset.tip = preview.cameraOff ? "Turn on camera" : "Turn off camera";
      container.querySelector(".meet-pre-video").classList.toggle("cam-off", preview.cameraOff);
      preview.stream?.getAudioTracks().forEach((t) => (t.enabled = !preview.muted));
      preview.stream?.getVideoTracks().forEach((t) => (t.enabled = !preview.cameraOff));
      if (preview.error) (note.hidden = false), (note.textContent = preview.error);
    };
    getPreview().then(() => {
      if (!container.contains(video) || !preview) return;
      if (preview.stream) video.srcObject = preview.stream;
      paint();
    });
    mic.onclick = () => {
      if (!preview?.stream?.getAudioTracks().length) return store.toast("No microphone allowed");
      preview.muted = !preview.muted;
      paint();
    };
    cam.onclick = () => {
      if (!preview?.stream?.getVideoTracks().length) return store.toast("No camera allowed");
      preview.cameraOff = !preview.cameraOff;
      paint();
    };
    container.querySelector("[data-join]").onclick = async (e) => {
      e.currentTarget.disabled = true;
      const pv = await getPreview();
      const stream = pv.stream;
      preview = null; // the meeting owns the stream now
      store.joinMeeting({ stream, muted: pv.muted, cameraOff: pv.cameraOff });
    };
    container.querySelector("[data-cancel]").onclick = () => {
      stopPreview();
      store.closeMeeting();
    };
  }

  /* ---------- waiting room ---------- */

  function renderWaiting() {
    const s = store.meetSession;
    container.innerHTML = `
      <div class="meet-screen meet-center">
        <div class="meet-card">
          <div class="meet-pulse">${avatar(store.getState().me, "xl")}</div>
          <h2>Asking to join…</h2>
          <p>${escapeHtml(s?.meeting?.title || "Bean meeting")} · someone inside will let you in.</p>
          <button type="button" class="meet-link-btn" data-cancel>Cancel</button>
        </div>
      </div>`;
    container.querySelector("[data-cancel]").onclick = () => store.closeMeeting();
  }

  /* ---------- ended ---------- */

  function renderEnded(m) {
    const reasons = {
      ended: ["The meeting has ended", "Thanks for joining."],
      over: ["This meeting is over", "Start a new one from any chat."],
      left: ["You left the meeting", ""],
      denied: ["You weren't let in", "Someone in the meeting declined your request."],
      removed: ["You were removed from the meeting", ""],
      missing: ["Meeting not found", m.error || "Check the link or code."],
    };
    const [title, sub] = reasons[m.reason] || reasons.ended;
    const canRejoin = m.reason === "left" && m.code;
    container.innerHTML = `
      <div class="meet-screen meet-center">
        <div class="meet-card">
          <span class="meet-end-icon">${icons.meet}</span>
          <h2>${escapeHtml(title)}</h2>
          ${sub ? `<p>${escapeHtml(sub)}</p>` : ""}
          <div class="meet-end-actions">
            ${canRejoin ? `<button type="button" class="btn-secondary" data-rejoin>Rejoin</button>` : ""}
            <button type="button" class="btn-primary" data-home>Back to chats</button>
          </div>
        </div>
      </div>`;
    container.querySelector("[data-home]").onclick = () => store.closeMeeting();
    container.querySelector("[data-rejoin]")?.addEventListener("click", () => {
      const code = m.code;
      store.setMeet(null);
      store.openMeeting(code);
    });
  }

  /* ---------- the meeting ---------- */

  function renderLiveShell() {
    container.innerHTML = `
      <div class="meet-screen meet-live">
        <header class="meet-top">
          <div class="meet-title"><strong></strong><span class="meet-clock"></span></div>
          <div class="meet-top-flags"></div>
        </header>
        <div class="meet-body">
          <div class="meet-stage"><div class="meet-main"></div><div class="meet-strip"></div></div>
          <aside class="meet-panel" hidden></aside>
        </div>
        <div class="meet-knocks"></div>
        <div class="meet-captions" hidden></div>
        <footer class="meet-bar"></footer>
      </div>`;
    const started = Date.now();
    const clockEl = container.querySelector(".meet-clock");
    clock = setInterval(() => {
      const s = store.meetSession;
      const from = s?.me?.joinedAt ? new Date(s.me.joinedAt).getTime() : started;
      clockEl.textContent = fmtClock(Date.now() - from);
    }, 1000);
    ringTimer = setInterval(() => {
      const s = store.meetSession;
      if (!s) return;
      for (const [key, el] of tiles) {
        const lvl = s.levels.get(key.replace(/^cam:/, "")) || 0;
        el.classList.toggle("speaking", key.startsWith("cam:") && lvl > 0.12);
      }
    }, 200);
  }

  function tileList(s) {
    const me = store.getState().me;
    const peersById = new Map(s.peers.map((p) => [p.id, p]));
    const list = [];
    list.push({ key: `cam:${s.peerId}`, self: true, user: me, stream: s.localStream, muted: s.muted, cameraOff: s.cameraOff, hand: s.hand, screen: false });
    if (s.screenStream) list.push({ key: `scr:${s.peerId}`, self: true, user: me, stream: s.screenStream, screen: true });
    for (const [id, link] of s.links) {
      const p = peersById.get(id);
      if (!p) continue;
      list.push({ key: `cam:${id}`, user: p.user, stream: link.camera, muted: p.muted, cameraOff: p.cameraOff || !link.camera?.getVideoTracks().some((t) => t.readyState === "live"), hand: p.hand, state: link.state, screen: false });
      if (link.screen) list.push({ key: `scr:${id}`, user: p.user, stream: link.screen, screen: true });
    }
    return list;
  }

  function makeTile(t) {
    const el = document.createElement("div");
    el.className = `meet-tile${t.screen ? " is-screen" : ""}${t.self ? " is-self" : ""}`;
    el.innerHTML = `
      <video autoplay playsinline ${t.self ? "muted" : ""} class="${t.self && !t.screen ? "mirror" : ""}"></video>
      <div class="meet-tile-off">${avatar(t.user, "xl")}</div>
      <div class="meet-tile-label"><span class="meet-tile-mic"></span><span class="meet-tile-name"></span></div>
      <span class="meet-tile-hand">${icons.hand}</span>
      <button type="button" class="meet-tile-pin" aria-label="Pin">${icons.pin}</button>
      ${t.self && t.screen ? `<div class="meet-self-share">${icons.screenShare}<span>You're presenting to everyone</span><button type="button" class="meet-pill" data-stop-share>Stop presenting</button></div>` : ""}`;
    el.querySelector("[data-stop-share]")?.addEventListener("click", () => store.meetSession?.stopScreen());
    el.querySelector(".meet-tile-pin").onclick = () => {
      pinned = pinned === t.key ? null : t.key;
      layout(store.meetSession);
    };
    return el;
  }

  function layout(s) {
    if (!s) return;
    const main = container.querySelector(".meet-main");
    const strip = container.querySelector(".meet-strip");
    if (!main) return;
    const list = tileList(s);
    const keys = new Set(list.map((t) => t.key));
    for (const [key, el] of tiles) {
      if (!keys.has(key)) {
        el.remove();
        tiles.delete(key);
      }
    }
    if (pinned && !keys.has(pinned)) pinned = null;
    const screens = list.filter((t) => t.screen);
    const spotlight = pinned ? list.filter((t) => t.key === pinned) : screens;
    const focus = spotlight.length > 0;
    container.querySelector(".meet-stage").classList.toggle("has-focus", focus);

    for (const t of list) {
      let el = tiles.get(t.key);
      if (!el) {
        el = makeTile(t);
        tiles.set(t.key, el);
      }
      const home = focus && !spotlight.includes(t) ? strip : main;
      if (el.parentElement !== home) home.appendChild(el);
      const video = el.querySelector("video");
      if (t.stream && video.srcObject !== t.stream) {
        video.srcObject = t.stream;
        video.play?.().catch(() => {});
      }
      if (!t.stream && video.srcObject) video.srcObject = null;
      const name = t.screen ? `${t.self ? "You are" : `${t.user?.displayName || "Someone"} is`} presenting` : t.self ? "You" : t.user?.displayName || "Bean user";
      const nameEl = el.querySelector(".meet-tile-name");
      if (nameEl.textContent !== name) nameEl.textContent = name;
      el.querySelector(".meet-tile-mic").innerHTML = !t.screen && t.muted ? icons.micOff : "";
      el.classList.toggle("cam-off", !t.screen && Boolean(t.cameraOff));
      el.classList.toggle("hand-up", Boolean(t.hand));
      el.classList.toggle("pinned", pinned === t.key);
      el.classList.toggle("weak", t.state === "connecting" || t.state === "new" || t.state === "disconnected");
    }
    const n = main.children.length;
    main.style.setProperty("--cols", String(n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4));
    main.style.setProperty("--rows", String(Math.ceil(n / (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4))));
    strip.hidden = !strip.children.length;
  }

  function renderBar(s) {
    const st = store.getState();
    const host = s.meeting.hostId === st.me.id;
    const waiting = s.peers.filter((p) => p.status === "waiting");
    const key = JSON.stringify([s.muted, s.cameraOff, Boolean(s.screenStream), s.hand, s.meeting.transcribing, s.meeting.locked, panel, menuOpen, waiting.length, host, s.peers.length]);
    if (key === barKey) return;
    barKey = key;
    closeSelect();
    const bar = container.querySelector(".meet-bar");
    bar.innerHTML = `
      <div class="meet-bar-left"><span class="meet-bar-code">${escapeHtml(s.meeting.code)}</span></div>
      <div class="meet-bar-mid">
        <button type="button" class="meet-btn ${s.muted ? "off" : ""}" data-a="mic" data-tip="${s.muted ? "Turn on microphone" : "Turn off microphone"}" aria-label="Microphone">${s.muted ? icons.micOff : icons.mic}</button>
        <button type="button" class="meet-btn ${s.cameraOff ? "off" : ""}" data-a="cam" data-tip="${s.cameraOff ? "Turn on camera" : "Turn off camera"}" aria-label="Camera">${s.cameraOff ? icons.videoOff : icons.video}</button>
        ${screenShareSupported ? `<button type="button" class="meet-btn ${s.screenStream ? "on" : ""}" data-a="screen" data-tip="${s.screenStream ? "Stop presenting" : "Share screen"}" aria-label="Share screen">${s.screenStream ? icons.screenStop : icons.screenShare}</button>` : ""}
        <button type="button" class="meet-btn ${s.meeting.transcribing ? "on" : ""}" data-a="cc" data-tip="${s.meeting.transcribing ? "Turn off captions & transcript" : "Captions & transcript"}" aria-label="Captions">${icons.captions}</button>
        <button type="button" class="meet-btn ${s.hand ? "on" : ""}" data-a="hand" data-tip="${s.hand ? "Lower hand" : "Raise hand"}" aria-label="Raise hand">${icons.hand}</button>
        <div class="meet-more-wrap">
          <button type="button" class="meet-btn" data-a="more" data-tip="More" aria-label="More">${icons.more}</button>
          ${
            menuOpen
              ? `<div class="meet-menu" role="menu">
                  <button type="button" data-m="people" class="m-only">${icons.users}<span>People${waiting.length ? ` · ${waiting.length} waiting` : ""}</span></button>
                  <button type="button" data-m="transcript" class="m-only">${icons.transcript}<span>Transcript</span></button>
                  <button type="button" data-m="hand" class="m-only">${icons.hand}<span>${s.hand ? "Lower hand" : "Raise hand"}</span></button>
                  <button type="button" data-m="copy">${icons.link}<span>Copy meeting link</span></button>
                  ${host ? `<button type="button" data-m="lock">${s.meeting.locked ? icons.unlock : icons.lock}<span>${s.meeting.locked ? "Unlock meeting" : "Lock meeting (no new requests)"}</span></button>` : ""}
                  ${captionsSupported ? `<div class="meet-menu-row">${icons.captions}<span>Caption language</span>${selectHtml("lang", CAPTION_LANGS, captionLang(), { label: "Caption language" })}</div>` : ""}
                  ${host ? `<button type="button" data-m="end" class="danger">${icons.phoneOff}<span>End meeting for everyone</span></button>` : ""}
                </div>`
              : ""
          }
        </div>
        <button type="button" class="meet-btn leave" data-a="leave" data-tip="Leave meeting" aria-label="Leave meeting">${icons.phoneOff}</button>
      </div>
      <div class="meet-bar-right">
        <button type="button" class="meet-btn flat ${panel === "people" ? "on" : ""}" data-a="people" data-tip="People" aria-label="People">${icons.users}${waiting.length ? `<i class="meet-badge">${waiting.length}</i>` : `<i class="meet-count">${s.peers.filter((p) => p.status === "joined").length}</i>`}</button>
        <button type="button" class="meet-btn flat ${panel === "transcript" ? "on" : ""}" data-a="transcript" data-tip="Transcript" aria-label="Transcript">${icons.transcript}</button>
      </div>`;

    bar.querySelectorAll("[data-a]").forEach((b) => {
      b.onclick = async () => {
        const a = b.dataset.a;
        const ses = store.meetSession;
        if (!ses) return;
        if (a === "mic") ses.toggleMute();
        else if (a === "cam") ses.toggleCamera();
        else if (a === "screen") ses.toggleScreen();
        else if (a === "hand") ses.toggleHand();
        else if (a === "cc") {
          if (!ses.meeting.transcribing && !captionsSupported) store.toast("Your own captions need Chrome, Edge or Safari. Others' captions still show here.");
          ses.setTranscribing(!ses.meeting.transcribing);
          if (!ses.meeting.transcribing) panel = panel || null;
        } else if (a === "more") {
          menuOpen = !menuOpen;
          barKey = "";
          renderBar(ses);
        } else if (a === "people" || a === "transcript") {
          panel = panel === a ? null : a;
          barKey = "";
          renderAll();
        } else if (a === "leave") store.closeMeeting();
      };
    });
    bar.querySelectorAll("[data-m]").forEach((b) => {
      const act = async () => {
        const ses = store.meetSession;
        if (!ses) return;
        const m = b.dataset.m;
        menuOpen = false;
        barKey = "";
        if (m === "copy") copy(meetUrl(ses.meeting.code));
        else if (m === "people" || m === "transcript") {
          panel = m;
          renderAll();
        } else if (m === "hand") ses.toggleHand();
        else if (m === "lock") ses.setLocked(!ses.meeting.locked);
        else if (m === "end") {
          if (await confirmDialog({ title: "End the meeting for everyone?", text: "Everyone will be disconnected.", confirm: "End meeting", danger: true })) ses.endForAll();
        }
        renderBar(ses);
      };
      b.onclick = act;
    });
    bindSelect(bar.querySelector('[data-select="lang"]'), CAPTION_LANGS, (v) => store.meetSession?.changeCaptionLang(v));
  }

  function renderPanel(s) {
    const el = container.querySelector(".meet-panel");
    const stage = container.querySelector(".meet-body");
    el.hidden = !panel;
    stage.classList.toggle("panel-open", Boolean(panel));
    if (!panel) return (el.innerHTML = "");
    const st = store.getState();
    const host = s.meeting.hostId === st.me.id;
    if (panel === "people") {
      const waiting = s.peers.filter((p) => p.status === "waiting");
      const joined = s.peers.filter((p) => p.status === "joined");
      const key = JSON.stringify(["people", waiting.map((p) => p.id), joined.map((p) => [p.id, p.muted, p.hand, p.sharing]), host]);
      if (el.dataset.key === key) return;
      el.dataset.key = key;
      el.innerHTML = `
        <div class="meet-panel-head"><strong>People</strong><button type="button" class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
        <button type="button" class="meet-invite" data-copy>${icons.link}<span>Copy meeting link</span></button>
        ${
          waiting.length
            ? `<p class="meet-panel-label">Waiting to join</p>${waiting
                .map(
                  (p) => `<div class="meet-person">${avatar(p.user, "sm")}<span><strong>${escapeHtml(p.user?.displayName || "Bean user")}</strong><small>@${escapeHtml(p.user?.username || "")}</small></span>
                  <button type="button" class="meet-pill" data-admit="${p.id}">Admit</button><button type="button" class="meet-pill ghost" data-deny="${p.id}">Deny</button></div>`
                )
                .join("")}`
            : ""
        }
        <p class="meet-panel-label">In the meeting · ${joined.length}</p>
        ${joined
          .map((p) => {
            const self = p.id === s.peerId;
            return `<div class="meet-person">${avatar(p.user, "sm")}<span><strong>${escapeHtml(self ? `${p.user?.displayName || "You"} (you)` : p.user?.displayName || "Bean user")}</strong><small>@${escapeHtml(p.user?.username || "")}${p.userId === s.meeting.hostId ? " · host" : ""}${p.sharing ? " · presenting" : ""}</small></span>
              ${p.hand ? `<span class="meet-person-icon">${icons.hand}</span>` : ""}${p.muted ? `<span class="meet-person-icon">${icons.micOff}</span>` : ""}
              ${host && !self ? `<button type="button" class="meet-pill ghost" data-remove="${p.id}">Remove</button>` : ""}</div>`;
          })
          .join("")}`;
    } else {
      const lines = s.captions;
      const key = JSON.stringify(["tr", lines.length, s.meeting.transcribing]);
      if (el.dataset.key === key) return;
      el.dataset.key = key;
      el.innerHTML = `
        <div class="meet-panel-head"><strong>Transcript</strong><button type="button" class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
        ${
          s.meeting.transcribing
            ? `<p class="meet-panel-note">Live. When the meeting ends, Neyo turns this into notes in the chat.</p>`
            : `<div class="meet-panel-empty"><p>Transcript is off.</p><button type="button" class="btn-primary" data-tr-on>Turn on captions & transcript</button><p class="meet-fine">Everyone will see that it's on.</p></div>`
        }
        <div class="meet-lines">${lines
          .map((l) => `<p><strong>${escapeHtml(l.name)}</strong> <time>${new Date(l.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time><br>${escapeHtml(l.text)}</p>`)
          .join("")}</div>`;
      const box = el.querySelector(".meet-lines");
      box.scrollTop = box.scrollHeight;
      el.querySelector("[data-tr-on]")?.addEventListener("click", () => {
        if (!captionsSupported) store.toast("Your own captions need Chrome, Edge or Safari. Others' captions still show here.");
        store.meetSession?.setTranscribing(true);
      });
    }
    el.querySelector("[data-close]").onclick = () => {
      panel = null;
      barKey = "";
      renderAll();
    };
    el.querySelector("[data-copy]")?.addEventListener("click", () => copy(meetUrl(s.meeting.code)));
    el.querySelectorAll("[data-admit]").forEach((b) => (b.onclick = () => store.meetSession?.admit(b.dataset.admit, true)));
    el.querySelectorAll("[data-deny]").forEach((b) => (b.onclick = () => store.meetSession?.admit(b.dataset.deny, false)));
    el.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (await confirmDialog({ title: "Remove from the meeting?", text: "They won't be able to join again.", confirm: "Remove", danger: true })) store.meetSession?.remove(b.dataset.remove);
        })
    );
  }

  function renderKnocks(s) {
    const box = container.querySelector(".meet-knocks");
    const waiting = panel === "people" ? [] : s.peers.filter((p) => p.status === "waiting");
    const key = waiting.map((p) => p.id).join(",");
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = waiting
      .slice(0, 3)
      .map(
        (p) => `<div class="meet-knock" role="alert">${avatar(p.user, "sm")}<span><strong>${escapeHtml(p.user?.displayName || "Bean user")}</strong><small>@${escapeHtml(p.user?.username || "")} wants to join</small></span>
        <button type="button" class="meet-pill" data-admit="${p.id}">Admit</button><button type="button" class="meet-pill ghost" data-deny="${p.id}">Deny</button></div>`
      )
      .join("");
    box.querySelectorAll("[data-admit]").forEach((b) => (b.onclick = () => store.meetSession?.admit(b.dataset.admit, true)));
    box.querySelectorAll("[data-deny]").forEach((b) => (b.onclick = () => store.meetSession?.admit(b.dataset.deny, false)));
  }

  function renderCaptions(s) {
    const box = container.querySelector(".meet-captions");
    const top = container.querySelector(".meet-top-flags");
    const flags = `${s.meeting.transcribing ? `<span class="meet-flag rec"><i></i>Transcript on</span>` : ""}${s.meeting.locked ? `<span class="meet-flag">${icons.lock}Locked</span>` : ""}`;
    if (top.innerHTML !== flags) top.innerHTML = flags;
    const titleEl = container.querySelector(".meet-title strong");
    if (titleEl.textContent !== s.meeting.title) titleEl.textContent = s.meeting.title;
    if (!s.meeting.transcribing) return (box.hidden = true);
    const now = Date.now();
    const recent = s.captions.filter((c) => now - new Date(c.at).getTime() < 9000 && c.userId !== store.getState().me.id).slice(-2);
    const lines = recent.map((c) => `<p><strong>${escapeHtml(c.name.split(" ")[0])}</strong> ${escapeHtml(c.text)}</p>`);
    if (s.interim) lines.push(`<p class="own"><strong>You</strong> ${escapeHtml(s.interim)}</p>`);
    box.hidden = !lines.length;
    const html = lines.join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function renderAll() {
    const s = store.meetSession;
    if (!s || phase !== "live") return;
    layout(s);
    renderBar(s);
    renderPanel(s);
    renderKnocks(s);
    renderCaptions(s);
  }

  /* captions fade even when nothing else changes */
  setInterval(() => phase === "live" && store.meetSession && renderCaptions(store.meetSession), 1500);

  document.addEventListener("click", (e) => {
    if (menuOpen && !e.target.closest?.(".meet-more-wrap, .bean-select-menu")) {
      menuOpen = false;
      barKey = "";
      store.meetSession && renderBar(store.meetSession);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (phase !== "live" || !store.meetSession || e.target.closest?.("input, textarea, select")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      store.meetSession.toggleMute();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
      e.preventDefault();
      store.meetSession.toggleCamera();
    }
  });

  const render = (st) => {
    const m = st.meet;
    const next = m?.phase || null;
    if (!m) {
      if (phase) {
        cleanup();
        stopPreview();
        container.innerHTML = "";
        document.body.classList.remove("in-meeting");
      }
      phase = null;
      return;
    }
    document.body.classList.add("in-meeting");
    if (next !== phase) {
      cleanup();
      phase = next;
      if (next === "loading" || next === "joining") container.innerHTML = `<div class="meet-screen meet-center"><div class="spinner"></div></div>`;
      else if (next === "prejoin") renderPrejoin(m);
      else if (next === "waiting") renderWaiting();
      else if (next === "ended") {
        stopPreview();
        renderEnded(m);
      } else if (next === "live") {
        renderLiveShell();
        renderAll();
      }
      return;
    }
    if (phase === "live") renderAll();
  };

  window.addEventListener("popstate", () => {
    if (store.getState().meet && !location.pathname.startsWith("/meet/")) store.closeMeeting();
  });

  store.subscribe(render);
  render(store.getState());
}
