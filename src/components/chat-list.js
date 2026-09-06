import { store } from "../core/store.js";

export function renderChatList() {
  const state = store.getState();

  return state.contacts
    .map((contact) => {
      const active = contact.id === state.activeContactId;

      return `
        <button
          class="chat-item ${active ? "active" : ""}"
          data-contact-id="${contact.id}"
          type="button"
        >
          <img
            class="chat-avatar"
            src="${contact.avatar}"
            alt="${contact.name}"
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
  const render = () => {
    container.innerHTML = renderChatList();
  };

  container.addEventListener("click", (event) => {
    const item = event.target.closest("[data-contact-id]");
    if (!item) return;

    store.setActiveContact(item.dataset.contactId);
  });

  store.subscribe(render);

  render();
}
