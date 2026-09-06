import { store } from "../core/store.js";

export function renderComposer(container) {
  container.innerHTML = `
    <form class="composer-form" id="composerForm">
      <div class="composer-pill-container">
        <button
          type="button"
          class="composer-action-btn"
          id="attachBtn"
          title="Attach File"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        <input
          type="text"
          id="messageInput"
          placeholder="Type a message..."
          autocomplete="off"
        />

        <button
          type="submit"
          class="composer-send-btn"
          title="Send Message"
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

if (!document.getElementById("composer-styles")) {
  const style = document.createElement("style");
  style.id = "composer-styles";

  style.textContent = `
    .composer-form {
      padding: 8px 12px;
      background: var(--color-bg, #fbf9f5);
      border-top: 1px solid var(--color-border, #e7e1d8);
    }

    .composer-pill-container {
      display: flex;
      align-items: center;
      width: 100%;
      background: var(--color-surface, #f2ece1);
      border: 1px solid var(--color-border, #e7e1d8);
      border-radius: 9999px;
      padding: 6px 8px 6px 12px;
      box-shadow: 0 2px 8px rgba(44, 37, 35, 0.06);
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .composer-pill-container:focus-within {
      border-color: var(--color-accent, #5a6b5c);
      box-shadow: 0 4px 14px rgba(44, 37, 35, 0.08);
    }

    .composer-action-btn {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-radius: 9999px;
      color: var(--color-text-secondary, #8a817b);
      cursor: pointer;
      transition: background 160ms ease, color 160ms ease;
    }

    .composer-action-btn:hover {
      color: var(--color-accent, #5a6b5c);
      background: rgba(90, 107, 92, 0.10);
    }

    #messageInput {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      padding: 8px 12px;
      color: var(--color-text, #2c2523);
      font-size: 14px;
    }

    #messageInput::placeholder {
      color: var(--color-text-secondary, #8a817b);
    }

    .composer-send-btn {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-radius: 12px;
      background: var(--color-accent, #5a6b5c);
      color: #ffffff;
      cursor: pointer;
      transition: opacity 160ms ease, transform 160ms ease;
    }

    .composer-send-btn:hover {
      opacity: 0.9;
      transform: scale(1.02);
    }
  `;

  document.head.appendChild(style);
}
