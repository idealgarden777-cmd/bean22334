/* Animated emoji (Google Noto Animated Emoji).
 *
 * - In text, every emoji with an animated version becomes a small Noto image
 *   (same crisp look on every phone / PC).
 * - Big emoji-only messages, reaction menus and the picker play the motion version
 *   (Lottie), only while visible or hovered. Reduced-motion users get the still image.
 * - If the CDN is unreachable the plain emoji character stays (img alt / fallback).
 */
import { ANIMATED } from "./emoji-set.js";

const CDN = "https://fonts.gstatic.com/s/e/notoemoji/latest";
const EMOJI_RE =
  /(?:\p{Regional_Indicator}{2})|(?:[#*0-9]\uFE0F?\u20E3)|(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu;

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* "👍🏽" -> "1f44d_1f3fd" if Noto has an animated version, else null */
export function emojiKey(emoji) {
  const cps = [...emoji].map((c) => c.codePointAt(0).toString(16));
  const full = cps.join("_");
  if (ANIMATED.has(full)) return full;
  const noVs = cps.filter((c) => c !== "fe0f").join("_");
  if (ANIMATED.has(noVs)) return noVs;
  const withVs = cps.length === 1 ? `${cps[0]}_fe0f` : null;
  if (withVs && ANIMATED.has(withVs)) return withVs;
  return null;
}

const stillUrl = (key) => `${CDN}/${key}/emoji.svg`;
const motionUrl = (key) => `${CDN}/${key}/lottie.json`;

/* one emoji -> HTML. size: "inline" | "big" | "react" | "pick" */
export function emojiTag(emoji, size = "inline") {
  const key = emojiKey(emoji);
  if (!key) return `<span class="emo-txt emo-${size}">${emoji}</span>`;
  const motion = size !== "inline";
  return `<span class="emo emo-${size}${motion ? " emo-motion" : ""}" data-emo="${key}" role="img" aria-label="${emoji}"><img src="${stillUrl(key)}" alt="${emoji}" draggable="false" loading="lazy" decoding="async"></span>`;
}

/* replace emojis in already-escaped HTML, never inside tags */
export function emojify(html, size = "inline") {
  return String(html)
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith("<") ? part : part.replace(EMOJI_RE, (e) => emojiTag(e, size))))
    .join("");
}

/* ---------------- motion (Lottie, loaded only when needed) ---------------- */

let lottieLib = null;
const loadLottie = () =>
  (lottieLib ||= import("lottie-web/build/player/lottie_light.js").then((m) => m.default || m));

async function start(el, { loop = true } = {}) {
  if (reduceMotion() || el.dataset.failed) return;
  if (el._anim) {
    el._anim.loop = loop;
    el._anim.goToAndPlay(0, true);
    return;
  }
  if (el._loading) return;
  el._loading = true;
  try {
    const lottie = await loadLottie();
    if (!el.isConnected) return;
    const holder = document.createElement("span");
    holder.className = "emo-lottie";
    el.append(holder);
    const anim = lottie.loadAnimation({
      container: holder,
      renderer: "svg",
      loop,
      autoplay: true,
      path: motionUrl(el.dataset.emo),
      rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: true },
    });
    anim.addEventListener("DOMLoaded", () => el.classList.add("is-moving"));
    anim.addEventListener("data_failed", () => {
      el.dataset.failed = "1";
      holder.remove();
    });
    el._anim = anim;
  } catch {
    el.dataset.failed = "1";
  } finally {
    el._loading = false;
  }
}

function stop(el) {
  el._anim?.pause();
}

function destroy(el) {
  el._anim?.destroy();
  el._anim = null;
}

/* Big emoji messages: play while on screen */
const seen = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) start(e.target);
      else stop(e.target);
    }
  },
  { rootMargin: "80px" }
);

const watched = new Set();
function scan(root) {
  root.querySelectorAll?.(".emo-big.emo-motion").forEach((el) => {
    if (watched.has(el) || !seen) return;
    watched.add(el);
    seen.observe(el);
  });
}

function sweep() {
  for (const el of watched) {
    if (!el.isConnected) {
      seen?.unobserve(el);
      destroy(el);
      watched.delete(el);
    }
  }
}

let sweepTimer;
export function initAnimatedEmoji() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined" || initAnimatedEmoji.done) return;
  initAnimatedEmoji.done = true;
  scan(document);
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) scan(n);
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(sweep, 1000);
  }).observe(document.body, { childList: true, subtree: true });

  // Reactions, picker, chips: animate on hover / focus
  const hoverSel = ".emo-react.emo-motion, .emo-pick.emo-motion";
  document.addEventListener("pointerover", (e) => {
    const el = e.target.closest?.("[data-emoji], .reaction-chip")?.querySelector(hoverSel);
    if (el && !el._hovered) {
      el._hovered = true;
      start(el, { loop: true });
    }
  });
  document.addEventListener("pointerout", (e) => {
    const host = e.target.closest?.("[data-emoji], .reaction-chip");
    if (!host || host.contains(e.relatedTarget)) return;
    const el = host.querySelector(hoverSel);
    if (el) {
      el._hovered = false;
      if (el._anim) el._anim.loop = false; // finish the current loop, then rest
    }
  });
  // a missing image falls back to the emoji character
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img?.tagName === "IMG" && img.parentElement?.classList.contains("emo")) {
        const span = img.parentElement;
        span.dataset.failed = "1";
        span.classList.add("emo-fallback");
        span.textContent = img.alt;
      }
    },
    true
  );
}
