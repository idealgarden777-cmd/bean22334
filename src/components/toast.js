import { store } from "../core/store.js";
import { escapeHtml } from "../core/utils.js";

export function mountToast(container) {
  let last = null;
  store.subscribe((s) => {
    if (s.toast === last) return;
    last = s.toast;
    container.innerHTML = s.toast ? `<div class="toast" role="status">${escapeHtml(s.toast)}</div>` : "";
  });
}
