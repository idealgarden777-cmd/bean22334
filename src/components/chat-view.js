import { store } from "../core/store.js";
import { mountChatHeader } from "./chat-header.js";
import { mountMessageList } from "./message-list.js";
import { mountComposer } from "./composer.js";

export function mountChatView(container) {
  let currentId;
  let cleanups = [];

  const render = (state) => {
    if (state.activeId === currentId) return;
    currentId = state.activeId;
    cleanups.forEach((fn) => fn && fn());
    cleanups = [];

    if (!currentId) {
      container.innerHTML = `
        <div class="chat-empty">
          <img class="chat-empty-icon" src="/bean-icon.png" alt="" width="64" height="64">
          <h2>Bean</h2>
          <p>Select a contact to start, or message anyone with a Bean ID.</p>
          <button type="button" class="btn-primary" data-action="new">New Message</button>
        </div>`;
      container.querySelector("[data-action=new]").onclick = () => store.openModal("new");
      return;
    }

    container.innerHTML = `
      <div class="chat-view-container">
        <div class="chat-header-slot"></div>
        <div class="message-list-slot"></div>
        <div class="composer-slot"></div>
        <div class="drop-overlay"><div>Drop to send</div></div>
      </div>`;

    cleanups.push(mountChatHeader(container.querySelector(".chat-header-slot")));
    cleanups.push(mountMessageList(container.querySelector(".message-list-slot")));
    cleanups.push(mountComposer(container.querySelector(".composer-slot")));

    const view = container.querySelector(".chat-view-container");
    let depth = 0;
    view.addEventListener("dragenter", (e) => {
      if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
      depth++;
      view.classList.add("dragging");
    });
    view.addEventListener("dragleave", () => {
      depth = Math.max(0, depth - 1);
      if (!depth) view.classList.remove("dragging");
    });
    view.addEventListener("dragover", (e) => e.preventDefault());
    view.addEventListener("drop", (e) => {
      e.preventDefault();
      depth = 0;
      view.classList.remove("dragging");
      if (e.dataTransfer?.files?.length) store.sendFiles(e.dataTransfer.files);
    });
  };

  store.subscribe(render);
  render(store.getState());
}
