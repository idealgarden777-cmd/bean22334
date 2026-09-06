import { mountAppShell } from "./components/app-shell.js";
import { store } from "./core/store.js";

document.addEventListener("DOMContentLoaded", () => {
  let root = document.getElementById("app");

  if (!root) {
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  }

  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";

  mountAppShell(root, store);
});
