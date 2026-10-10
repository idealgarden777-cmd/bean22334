import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "./core/theme.js";
import { mountAppShell } from "./components/app-shell.js";
import { store } from "./core/store.js";
import { initAnimatedEmoji } from "./core/emoji-anim.js";
import { mountTooltips } from "./components/tooltip.js";
import { stopVoice } from "./core/voice-player.js";
import { initBrandInk } from "./core/brand-ink.js";
import { initViewport } from "./core/mobile-viewport.js";
import { looksLikeBean } from "./core/utils.js";
import { confirmDialog } from "./components/dialog.js";

/* Links in chats: Bean meeting links open inside Bean; anything else asks first
 * and shows the real address, with a loud warning for Bean look-alikes. */
function guardLinks() {
  document.addEventListener(
    "click",
    async (e) => {
      const a = e.target.closest?.("a[data-meet-link], a[data-ext]");
      if (!a || e.defaultPrevented) return;
      e.preventDefault();
      if (a.dataset.meetLink) return store.openMeeting(a.dataset.meetLink);
      const host = a.dataset.ext;
      const fake = looksLikeBean(host);
      const ok = await confirmDialog({
        title: fake ? "Careful: this is not Bean" : "Open a link outside Bean?",
        text: fake
          ? `${host} only looks like Bean. Real Bean pages are on bean.signaturesi.com. Never type your Bean password on another site.`
          : `This opens ${host} in a new tab. Bean will never ask for your password on another site.`,
        confirm: fake ? "Open anyway" : "Open link",
        danger: fake,
      });
      if (ok) window.open(a.href, "_blank", "noopener,noreferrer");
    },
    true
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initBrandInk();
  initViewport();
  guardLinks();
  let root = document.getElementById("app");
  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  }
  mountAppShell(root);
  initAnimatedEmoji();
  mountTooltips();
  store.init();
  store.subscribe((s) => (s.call || s.meet?.phase === "live") && stopVoice()); // a call always wins over a voice note
});
