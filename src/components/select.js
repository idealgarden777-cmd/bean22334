/* Bean dropdown: replaces the browser's <select>. Same look everywhere,
 * opens down or up (whichever fits), keyboard friendly, closes on outside tap. */
import { escapeHtml } from "../core/utils.js";

const CHEVRON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
const CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`;

/* markup: <button class="bean-select" data-select="name"> … ; then bindSelect(button, options, value, onChange) */
export function selectHtml(name, options, value, { label = "", className = "" } = {}) {
  const cur = options.find(([v]) => v === value) || options[0];
  return `<button type="button" class="bean-select ${className}" data-select="${escapeHtml(name)}" data-value="${escapeHtml(cur?.[0] ?? "")}" aria-haspopup="listbox" aria-expanded="false" ${label ? `aria-label="${escapeHtml(label)}"` : ""}><span class="bs-value">${escapeHtml(cur?.[1] ?? "")}</span>${CHEVRON}</button>`;
}

let openMenu = null;
export const closeSelect = () => close();
function close() {
  if (!openMenu) return;
  openMenu.btn.setAttribute("aria-expanded", "false");
  openMenu.el.remove();
  document.removeEventListener("pointerdown", openMenu.outside, true);
  document.removeEventListener("keydown", openMenu.key, true);
  window.removeEventListener("bean:viewport", openMenu.onViewport);
  openMenu = null;
}

export function bindSelect(btn, options, onChange) {
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (openMenu?.btn === btn) return close();
    close();
    const value = btn.dataset.value;
    const el = document.createElement("div");
    el.className = "bean-select-menu";
    el.setAttribute("role", "listbox");
    el.innerHTML = options
      .map(([v, l]) => `<button type="button" role="option" data-v="${escapeHtml(v)}" aria-selected="${v === value}"><span>${escapeHtml(l)}</span>${v === value ? CHECK : ""}</button>`)
      .join("");
    document.body.appendChild(el);
    // place: below if it fits, otherwise above; never off-screen
    const r = btn.getBoundingClientRect();
    const vh = window.visualViewport?.height || window.innerHeight;
    const vw = window.innerWidth;
    const w = Math.max(r.width, 200);
    const h = Math.min(el.scrollHeight, 320);
    const down = vh - r.bottom >= h + 12 || r.top < h + 12;
    el.style.width = `${Math.min(w, vw - 16)}px`;
    el.style.left = `${Math.max(8, Math.min(r.left, vw - w - 8))}px`;
    el.style.maxHeight = `${Math.max(120, Math.min(320, down ? vh - r.bottom - 16 : r.top - 16))}px`;
    if (down) el.style.top = `${r.bottom + 6}px`;
    else el.style.bottom = `${vh - r.top + 6}px`;
    el.classList.add(down ? "down" : "up");
    btn.setAttribute("aria-expanded", "true");

    const items = [...el.querySelectorAll("[data-v]")];
    const pick = (v) => {
      const opt = options.find(([x]) => x === v);
      if (!opt) return;
      btn.dataset.value = v;
      btn.querySelector(".bs-value").textContent = opt[1];
      close();
      btn.focus({ preventScroll: true });
      onChange?.(v);
    };
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const b = ev.target.closest("[data-v]");
      if (b) pick(b.dataset.v);
    });
    (items.find((b) => b.dataset.v === value) || items[0])?.focus({ preventScroll: true });
    items.find((b) => b.dataset.v === value)?.scrollIntoView?.({ block: "nearest" });
    const outside = (ev) => !el.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target) && close();
    const key = (ev) => {
      const i = items.indexOf(document.activeElement);
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        close();
        btn.focus({ preventScroll: true });
      } else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        items[(i + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
      } else if (ev.key === "Tab") close();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    // the screen really changed size (rotation, keyboard): close; focus checks don't count
    const onViewport = (ev) => Math.abs((ev.detail?.visualH || vh) - vh) > 40 && close();
    window.addEventListener("bean:viewport", onViewport);
    openMenu = { btn, el, outside, key, onViewport };
  });
}
