import { store } from "../core/store.js";

export function renderMessageList() {
  const state = store.getState();
  const messages = store.getActiveMessages();

  return messages
    .map((message) => {
      const own = message.senderId === state.currentUser.id;

      return `
        <div class="message ${own ? "message-own" : "message-other"}">
          <div class="message-bubble">
            ${escapeHtml(message.text)}
          </div>
          <span class="message-time">${message.timestamp}</span>
        </div>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export function initMessageList(container) {
  const render = () => {
    container.innerHTML = renderMessageList();
    container.scrollTop = container.scrollHeight;
  };

  store.subscribe(render);

  render();
}
