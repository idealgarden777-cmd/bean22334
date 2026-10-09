import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml, lastSeen } from "../core/utils.js";

function subtitle(conv, state) {
  const typingIds = state.typing[conv.id] || [];
  if (typingIds.length) {
    if (conv.type === "dm") return `<span class="typing-text">typing…</span>`;
    const names = typingIds.map((id) => store.userName(id, conv).split(" ")[0]);
    return `<span class="typing-text">${escapeHtml(names.join(", "))} ${names.length > 1 ? "are" : "is"} typing…</span>`;
  }
  if (conv.type === "group") {
    const online = conv.members.filter((m) => m.online && m.id !== state.me.id).length;
    return `${conv.members.length} members${online ? ` · ${online} online` : ""}`;
  }
  if (conv.peer?.isBot) return `<span class="plain-status">AI · not end-to-end encrypted</span>`;
  if (conv.peer?.ghost) return `<span class="ghost-status">👻 Away${conv.peer.away?.note ? ` · ${escapeHtml(conv.peer.away.note)}` : ""}</span>`;
  return escapeHtml(lastSeen(conv.peer));
}

export function mountChatHeader(container) {
  let lastKey = "";

  const render = (state) => {
    const conv = store.conversation();
    if (!conv) return;
    const key = JSON.stringify([conv.id, conv.title, conv.members.length, conv.peer?.online, conv.peer?.lastSeenAt, conv.peer?.ghost, conv.peer?.away?.note, state.typing[conv.id], state.call?.id, conv.muted]);
    if (key === lastKey) return;
    lastKey = key;

    const dm = conv.type === "dm";
    const inCall = Boolean(state.call);
    container.innerHTML = `
      <header class="chat-header-container">
        <button type="button" class="icon-btn back-btn" data-action="back" aria-label="Back to chats">${icons.arrowLeft}</button>
        <button type="button" class="chat-header-participant" data-action="info">
          ${avatar(dm ? conv.peer : conv, "md", { online: dm && conv.peer?.online })}
          <span class="participant-info">
            <span class="participant-name">${escapeHtml(conv.title)}${conv.e2ee !== false ? ` <span class="e2ee-lock" title="End-to-end encrypted">${icons.lock}</span>` : ""}${conv.muted ? ` <span class="muted-icon">${icons.bellOff}</span>` : ""}</span>
            <span class="participant-status">${subtitle(conv, state)}</span>
          </span>
        </button>
        <div class="chat-header-actions">
          ${
            dm && !conv.peer?.isBot
              ? `<button type="button" class="icon-btn" data-action="audio" ${inCall ? "disabled" : ""} title="Voice call" aria-label="Voice call">${icons.phone}</button>
                 <button type="button" class="icon-btn" data-action="video" ${inCall ? "disabled" : ""} title="Video call" aria-label="Video call">${icons.video}</button>`
              : ""
          }
          <button type="button" class="icon-btn" data-action="info" title="${dm ? "Contact info" : "Group info"}" aria-label="Info">${icons.info}</button>
        </div>
      </header>`;

    container.querySelector("[data-action=back]").onclick = () => store.closeChat();
    container.querySelectorAll("[data-action=info]").forEach((b) => (b.onclick = () => store.togglePanel()));
    container.querySelector("[data-action=audio]")?.addEventListener("click", () => store.startCall("audio"));
    container.querySelector("[data-action=video]")?.addEventListener("click", () => store.startCall("video"));
  };

  const unsub = store.subscribe(render);
  render(store.getState());
  const timer = setInterval(() => {
    lastKey = "";
    render(store.getState());
  }, 30000);
  return () => {
    unsub();
    clearInterval(timer);
  };
}
