/* Small notices above the composer: a contact's security key changed, or they are away. */
import { store } from "../core/store.js";
import { e2ee } from "../core/e2ee.js";
import { icons } from "./icons.js";
import { escapeHtml } from "../core/utils.js";

export function mountChatBanner(container) {
  let lastKey = "";
  const render = (state) => {
    const conv = store.conversation();
    if (!conv) return;
    const changed = conv.e2ee === false ? [] : conv.members.filter((m) => m.id !== state.me.id && e2ee.keyChanged(m.id));
    const away = conv.type === "dm" && conv.peer && !conv.peer.isBot && conv.peer.ghost ? conv.peer : null;
    const key = JSON.stringify([conv.id, changed.map((m) => m.id), away?.away?.note, Boolean(away), state.keyTick]);
    if (key === lastKey) return;
    lastKey = key;
    let html = "";
    for (const m of changed) {
      html += `<div class="chat-banner warn">${icons.alert}<span><strong>${escapeHtml(m.displayName)} ki security key badal gayi.</strong> Naya device ya Chat Lock reset ho sakta hai. Shak ho to unse safety number milayein.</span>
        <button type="button" class="btn-primary btn-sm" data-accept="${escapeHtml(m.id)}">Theek hai</button></div>`;
    }
    if (away) {
      html += `<div class="chat-banner away"><span>👻</span><span><strong>${escapeHtml(away.displayName)} away hain</strong>${away.away?.note ? ` · ${escapeHtml(away.away.note)}` : ""}<small>Message chala jayega; wapas aa kar dekhenge.</small></span></div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll("[data-accept]").forEach((b) => (b.onclick = () => store.acceptKey(b.dataset.accept)));
  };
  const unsub = store.subscribe(render);
  render(store.getState());
  return unsub;
}
