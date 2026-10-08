import { store } from "../core/store.js";
import { avatar, escapeHtml, formatListTime } from "../core/utils.js";

export function mountChatList(container) {
  let lastKey = "";

  const render = (state) => {
    const items = store.getFilteredConversations();
    const key = JSON.stringify([state.activeId, state.search, items.map((c) => [c.id, c.updatedAt, c.lastMessage])]);
    if (key === lastKey) return;
    lastKey = key;

    if (!items.length) {
      container.innerHTML = `<p class="chat-list-empty">${
        state.search ? "No chats match your search." : "No chats yet. Tap + to message a Bean ID."
      }</p>`;
      return;
    }

    container.innerHTML = items
      .map((c) => {
        const mine = c.lastSenderId === state.me.id;
        return `
          <button type="button" class="chat-item ${c.id === state.activeId ? "active" : ""}" data-id="${escapeHtml(c.id)}">
            ${avatar(c.contact)}
            <span class="chat-info">
              <span class="chat-info-top">
                <strong>${escapeHtml(c.contact.displayName)}</strong>
                <time>${formatListTime(c.updatedAt)}</time>
              </span>
              <small>${mine ? "You: " : ""}${escapeHtml(c.lastMessage || c.contact.beanId)}</small>
            </span>
          </button>`;
      })
      .join("");
  };

  container.addEventListener("click", (e) => {
    const item = e.target.closest("[data-id]");
    if (item) store.selectConversation(item.dataset.id);
  });

  store.subscribe(render);
  render(store.getState());
}
