/* One shared, in-app voice note player.
 * - one <audio> element for the whole app (works with iOS gesture rules)
 * - streams the signed link directly; if the browser rejects it (wrong stored type),
 *   it re-loads the bytes with the right type and plays from memory
 * - seek by tapping the waveform, 1x / 1.5x / 2x speed */
import { store } from "./store.js";
import { blobUrlFor, cachedBlobUrl } from "./media.js";
import { formatDuration } from "./utils.js";

const RATES = [1, 1.5, 2];
const state = { id: null, url: null, mime: "", duration: 0, rate: 1, loading: false, retried: false };
let audio = null;
let paintFn = () => {};

export function onVoicePaint(fn) {
  paintFn = fn;
}

function el() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  const repaint = () => paintFn();
  ["play", "pause", "timeupdate", "loadedmetadata", "waiting", "playing"].forEach((ev) => audio.addEventListener(ev, repaint));
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    repaint();
  });
  audio.addEventListener("error", async () => {
    if (!state.id || state.retried) return failed();
    state.retried = true;
    state.loading = true;
    repaint();
    try {
      const at = audio.currentTime || 0;
      audio.src = await blobUrlFor(state.url, state.mime || undefined);
      audio.currentTime = at;
      audio.playbackRate = state.rate;
      await audio.play();
    } catch {
      // some phones need a fresh tap after loading
      if (cachedBlobUrl(state.url)) store.toast("Tap play again");
      else failed();
    } finally {
      state.loading = false;
      repaint();
    }
  });
  return audio;
}

function failed() {
  const webm = /webm/.test(state.mime) && !el().canPlayType("audio/webm");
  store.toast(webm ? "This voice note was recorded on another browser that this device can't play. Save it from the menu." : "Couldn't play this voice note");
  stopVoice();
}

export function voiceStatus(id) {
  if (id !== state.id || !audio) return null;
  const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : state.duration;
  return {
    playing: !audio.paused,
    loading: state.loading || (audio.readyState < 3 && !audio.paused),
    current: audio.currentTime || 0,
    total,
    progress: total ? Math.min(1, (audio.currentTime || 0) / total) : 0,
    rate: state.rate,
    time: formatDuration(audio.paused && !audio.currentTime ? state.duration : audio.currentTime),
  };
}

export function toggleVoice({ id, url, mime, duration }) {
  const a = el();
  if (state.id === id) {
    if (a.paused) a.play().catch(() => {});
    else a.pause();
    return;
  }
  a.pause();
  Object.assign(state, { id, url, mime: String(mime || "").split(";")[0], duration: Number(duration) || 0, retried: false, loading: false });
  a.src = cachedBlobUrl(url) || url; // set synchronously inside the tap
  a.playbackRate = state.rate;
  a.play().catch((err) => {
    if (err?.name === "NotAllowedError") store.toast("Tap play again");
  });
  paintFn();
}

export function seekVoice(id, fraction) {
  if (state.id !== id || !audio) return;
  const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : state.duration;
  if (!total) return;
  audio.currentTime = Math.max(0, Math.min(total - 0.05, total * fraction));
  if (audio.paused) audio.play().catch(() => {});
}

export function cycleRate() {
  state.rate = RATES[(RATES.indexOf(state.rate) + 1) % RATES.length];
  if (audio) audio.playbackRate = state.rate;
  paintFn();
}

export function stopVoice() {
  if (!state.id) return;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  state.id = null;
  paintFn();
}
