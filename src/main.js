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

document.addEventListener("DOMContentLoaded", () => {
  let root = document.getElementById("app");
  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  }
  mountAppShell(root);
  initAnimatedEmoji();
  store.init();
});
