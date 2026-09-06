import { store } from "../core/store.js";

export function renderComposer(container) {
  container.innerHTML = `
    <form class="composer-form" id="composerForm">
      <div class="composer-pill-container">

        <button
          type="button"
          class="composer-action-btn"
          id="attachBtn"
          aria-label="Attach file"
          title="Attach file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        <input
          id="messageInput"
          type="text"
          placeholder="Type a message..."
          autocomplete="off"
        />

        <button
          type="submit"
          class="composer-send-btn"
          aria-label="Send message"
          title="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>

      </div>
    </form>
  `;

  const form = container.querySelector("#composerForm");
  const input = container.querySelector("#messageInput");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    store.sendMessage(text);
    input.value = "";
    input.focus();
  });
}
