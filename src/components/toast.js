import { store } from "../core/store.js";
import { escapeHtml } from "../core/utils.js";

/* store.toast("text") or store.toast({ text, action, onAction }) */
export function mountToast(container) {
  let last = null;
  store.subscribe((s) => {
    if (s.toast === last) return;
    last = s.toast;
    if (!s.toast) return (container.innerHTML = "");
    const t = typeof s.toast === "string" ? { text: s.toast } : s.toast;
    container.innerHTML = `<div class="toast ${t.action ? "has-action" : ""}" role="status"><span>${escapeHtml(t.text)}</span>${
      t.action ? `<button type="button" class="toast-action">${escapeHtml(t.action)}</button>` : ""
    }</div>`;
    const btn = container.querySelector(".toast-action");
    if (btn) btn.onclick = () => t.onAction?.();
  });
}
