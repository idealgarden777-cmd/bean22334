/* Bean app viewport (port of NEYO public/js/components/mobile-viewport.js).
 * - the app is exactly the visible screen: --app-height / --visual-viewport-offset-top
 * - keyboard open/closed classes, so only the message list moves, never the page
 * - one fixed size: no pinch / double-tap / ctrl+wheel / ctrl +/- page zoom      */
const KEYBOARD_THRESHOLD = 120;
let frame = null;
let keyboardOpen = false;

// remembered from the last real scroll: when the screen shrinks (keyboard) the
// browser clamps the list and fires its own scroll, which must not count
let wasAtBottom = true;
let lastListH = 0;
const ro = typeof ResizeObserver !== "undefined"
  ? new ResizeObserver(([entry]) => {
      const l = entry.target;
      if (wasAtBottom && l.clientHeight !== lastListH) l.scrollTop = l.scrollHeight;
      lastListH = l.clientHeight;
    })
  : null;
let observed = null;
document.addEventListener(
  "scroll",
  (e) => {
    const l = e.target;
    if (!l?.classList?.contains("message-scroll")) return;
    if (observed !== l && ro) {
      if (observed) ro.unobserve(observed);
      ro.observe(l);
      observed = l;
      lastListH = l.clientHeight;
    }
    if (l.clientHeight !== lastListH) return; // resize-driven scroll
    wasAtBottom = l.scrollHeight - l.scrollTop - l.clientHeight < 80;
  },
  { capture: true, passive: true }
);
const atBottom = () => wasAtBottom && !!document.querySelector(".message-scroll");

function update(source = "viewport") {
  const vv = window.visualViewport;
  const layoutH = window.innerHeight;
  const visualH = vv?.height || layoutH;
  const offsetTop = vv?.offsetTop || 0;
  const keyboard = Math.max(0, layoutH - visualH - offsetTop);
  const wasOpen = keyboardOpen;
  keyboardOpen = keyboard >= KEYBOARD_THRESHOLD;
  const stick = atBottom();

  const root = document.documentElement;
  const px = (v) => `${Math.max(0, Math.round(v))}px`;
  root.style.setProperty("--layout-viewport-height", px(layoutH));
  root.style.setProperty("--visual-viewport-height", px(visualH));
  root.style.setProperty("--visual-viewport-offset-top", px(offsetTop));
  root.style.setProperty("--keyboard-height", px(keyboard));
  root.style.setProperty("--app-height", px(visualH));
  root.classList.toggle("keyboard-open", keyboardOpen);
  root.classList.toggle("keyboard-closed", !keyboardOpen);

  // keep the newest message in view when the keyboard opens or the screen resizes
  if (stick || (keyboardOpen && !wasOpen)) {
    requestAnimationFrame(() => {
      const list = document.querySelector(".message-scroll");
      if (list && (stick || keyboardOpen)) list.scrollTop = list.scrollHeight;
    });
  }
  // iOS sometimes scrolls the whole page when the keyboard opens: put it back
  if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
  window.dispatchEvent(new CustomEvent("bean:viewport", { detail: { source, keyboardOpen, keyboard, visualH, offsetTop } }));
}

const schedule = (source) => {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    update(source);
  });
};

function lockZoom() {
  // iOS Safari ignores user-scalable=no: stop pinch + double-tap zoom ourselves
  ["gesturestart", "gesturechange", "gestureend"].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener("touchmove", (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });
  // double-tap zoom is off through CSS touch-action: manipulation (shell.css)
  // desktop: ctrl/cmd + wheel and ctrl/cmd + / - / 0
  window.addEventListener("wheel", (e) => (e.ctrlKey || e.metaKey) && e.preventDefault(), { passive: false });
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && ["+", "=", "-", "_", "0"].includes(e.key)) e.preventDefault();
  });
}

export function initViewport() {
  window.addEventListener("resize", () => schedule("resize"), { passive: true });
  window.visualViewport?.addEventListener("resize", () => schedule("visual-resize"), { passive: true });
  window.visualViewport?.addEventListener("scroll", () => schedule("visual-scroll"), { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(() => update("orientation"), 120));
  document.addEventListener("focusin", (e) => {
    if (e.target?.matches?.("input, textarea, [contenteditable]")) setTimeout(() => update("focusin"), 80);
  });
  document.addEventListener("focusout", () => [50, 180, 350].forEach((d) => setTimeout(() => update("focusout"), d)));
  window.addEventListener("pageshow", () => update("pageshow"));
  document.addEventListener("visibilitychange", () => !document.hidden && setTimeout(() => update("visibility"), 50));
  lockZoom();
  update("initial");
}
