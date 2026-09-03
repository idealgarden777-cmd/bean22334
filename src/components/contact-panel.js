"use strict";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

export function createContactPanel(conversation) {
  return `
    <aside class="bean-contact-panel" id="contactPanel" aria-label="Conversation details">
      <header><h2>Details</h2><button type="button" data-contact-action="close" aria-label="Close">×</button></header>
      <div class="bean-contact-panel__profile">
        <div class="bean-contact-panel__avatar">${escapeHTML(conversation.initials)}</div>
        <h3>${escapeHTML(conversation.name)}</h3>
        <p>${escapeHTML(conversation.beanId)}</p>
        <small>${conversation.status === "online" ? "Online" : "Offline"}</small>
      </div>
      <div class="bean-contact-panel__actions">
        <button type="button" data-contact-action="voice">Call</button>
        <button type="button" data-contact-action="video">Video</button>
        <button type="button" data-contact-action="search">Search</button>
        <button type="button" data-contact-action="mute">Mute</button>
      </div>
      <div class="bean-contact-panel__section">
        <button type="button" data-contact-action="media">Media <span>›</span></button>
        <button type="button" data-contact-action="files">Files <span>›</span></button>
        <button type="button" data-contact-action="links">Links <span>›</span></button>
        <button class="is-danger" type="button" data-contact-action="block">Block contact <span>›</span></button>
      </div>
    </aside>
  `;
}

export function initContactPanel(onAction) {
  const panel = document.getElementById("contactPanel");
  if (!panel) return;
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-contact-action]");
    if (button?.dataset.contactAction) onAction?.(button.dataset.contactAction);
  });
}
