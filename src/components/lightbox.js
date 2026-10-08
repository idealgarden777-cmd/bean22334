import { icons } from "./icons.js";
import { escapeHtml } from "../core/utils.js";

let slot = null;

export function mountLightbox(container) {
  slot = container;
}

export function openLightbox(url, name = "") {
  if (!slot || !url) return;
  slot.innerHTML = `
    <div class="lightbox" role="dialog" aria-label="Photo">
      <div class="lightbox-bar">
        <span>${escapeHtml(name)}</span>
        <a class="icon-btn" href="${escapeHtml(url)}" download target="_blank" rel="noopener" aria-label="Download">${icons.download}</a>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icons.close}</button>
      </div>
      <img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" />
    </div>`;
  const box = slot.querySelector(".lightbox");
  const close = () => {
    slot.innerHTML = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  box.addEventListener("click", (e) => {
    if (e.target === box || e.target.closest("[data-close]") || e.target.tagName === "IMG") close();
  });
}
