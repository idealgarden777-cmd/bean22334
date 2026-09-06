import { store } from "../core/store.js";

export function renderContactPanel(container) {
  const state = store.getState();

  const contact =
    state.contacts.find(
      (item) => item.id === state.activeContactId
    ) || state.contacts[0];

  container.innerHTML = `
    <aside class="contact-panel">
      <div class="contact-panel-header">
        <span>Contact Info</span>
      </div>

      <div class="contact-panel-content">
        <img
          src="${contact.avatar}"
          alt="${contact.name}"
          class="contact-panel-avatar"
        />

        <h3>${contact.name}</h3>
        <p>${contact.status}</p>
      </div>
    </aside>
  `;

  if (!document.getElementById("contact-panel-styles")) {
    const style = document.createElement("style");
    style.id = "contact-panel-styles";

    style.textContent = `
      .contact-panel-header {
        height: 72px;
        display: flex;
        align-items: center;
        padding: 0 20px;
        border-bottom: 1px solid var(--color-border);
        font-size: 16px;
        font-weight: 600;
      }

      .contact-panel-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 20px;
        text-align: center;
      }

      .contact-panel-avatar {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 9999px;
        margin-bottom: 16px;
      }

      .contact-panel-content h3 {
        margin: 0;
        color: var(--color-text);
        font-size: 16px;
        font-weight: 600;
      }

      .contact-panel-content p {
        margin: 6px 0 0;
        color: var(--color-muted);
        font-size: 12px;
      }
    `;

    document.head.appendChild(style);
  }
}
