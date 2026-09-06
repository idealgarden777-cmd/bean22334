import { store } from "../core/store.js";

export function renderChatList(container) {
  const state = store.getState();

  container.innerHTML = state.contacts
    .map((contact) => {
      const active = contact.id === state.activeContactId;

      return `
        <button
          type="button"
          class="chat-item ${active ? "active" : ""}"
          data-contact-id="${contact.id}"
        >
          <img
            src="${contact.avatar}"
            alt="${contact.name}"
            class="chat-avatar"
          />

          <span class="chat-info">
            <strong>${contact.name}</strong>
            <small>${contact.status}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

export function initChatList(container) {
  const render = () => renderChatList(container);

  container.addEventListener("click", (event) => {
    const item = event.target.closest("[data-contact-id]");
    if (!item) return;

    store.setActiveContact(item.dataset.contactId);
  });

  store.subscribe(render);

  render();
}
