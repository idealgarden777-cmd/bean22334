import { store } from "../core/store.js";
import { logoMark } from "./logo.js";
import { renderChatHeader } from "./chat-header.js";
import { mountMessageList } from "./message-list.js";
import { renderComposer } from "./composer.js";

export function mountChatView(container) {
  let currentId;
  let unsubscribeList = null;

  const render = (state) => {
    if (state.activeId === currentId) return;
    currentId = state.activeId;
    if (unsubscribeList) unsubscribeList();
    unsubscribeList = null;

    if (!currentId) {
      container.innerHTML = `
        <div class="chat-empty">
          <span class="chat-empty-mark">${logoMark}</span>
          <h2>Bean Messenger</h2>
          <p>Pick a chat or start a new one with any Bean ID.</p>
          <button type="button" class="btn-primary" data-action="new">New chat</button>
        </div>`;
      container.querySelector("[data-action=new]").onclick = () => store.toggleNewChat(true);
      return;
    }

    container.innerHTML = `
      <div class="chat-view-container">
        <div class="chat-header-slot"></div>
        <div class="message-list-slot"></div>
        <div class="composer-slot"></div>
      </div>`;

    renderChatHeader(container.querySelector(".chat-header-slot"));
    unsubscribeList = mountMessageList(container.querySelector(".message-list-slot"));
    renderComposer(container.querySelector(".composer-slot"));
  };

  store.subscribe(render);
  render(store.getState());
}
