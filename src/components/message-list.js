import { store } from "../core/store.js";

export function renderMessageList(container) {
  const state = store.getState();
  const messages = store.getActiveMessages();

  container.innerHTML = `
    <div class="message-list">
      ${messages.map((message) => {
        const own = message.senderId === state.currentUser.id;
        const contact = state.contacts.find(
          (item) => item.id === message.senderId
        );

        return `
          <div class="message-row ${own ? "own" : "other"}">
            ${
              !own
                ? `
                  <img
                    src="${contact?.avatar || ""}"
                    alt="${contact?.name || ""}"
                    class="message-avatar"
                  />
                `
                : ""
            }

            <div class="message-content">
              <div class="message-bubble">
                ${escapeHtml(message.text)}
              </div>

              <div class="message-meta">
                <span>${message.timestamp}</span>
                ${
                  own
                    ? `<span class="message-checks">✓✓</span>`
                    : ""
                }
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  const list = container.querySelector(".message-list");

  requestAnimationFrame(() => {
    list.scrollTop = list.scrollHeight;
  });

  if (!document.getElementById("message-list-styles")) {
    const style = document.createElement("style");
    style.id = "message-list-styles";

    style.textContent = `
      .message-list {
        height: 100%;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .message-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        max-width: 78%;
      }

      .message-row.own {
        margin-left: auto;
        justify-content: flex-end;
      }

      .message-row.other {
        margin-right: auto;
      }

      .message-avatar {
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
        border-radius: 9999px;
        object-fit: cover;
      }

      .message-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .message-row.own .message-content {
        align-items: flex-end;
      }

      .message-bubble {
        padding: 10px 14px;
        border-radius: 12px;
        background: var(--color-surface, #f2ece1);
        color: var(--color-text, #2c2523);
        font-size: 14px;
        line-height: 1.45;
        word-break: break-word;
      }

      .message-row.own .message-bubble {
        background: var(--color-accent-soft, #e8eee8);
      }

      .message-meta {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 0 3px;
        font-size: 12px;
        color: var(--color-text-secondary, #8a817b);
      }

      .message-checks {
        letter-spacing: -2px;
      }

      @media (max-width: 760px) {
        .message-list {
          padding: 14px;
        }

        .message-row {
          max-width: 88%;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
