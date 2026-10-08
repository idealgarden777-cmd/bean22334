import { store } from "../core/store.js";
import { escapeHtml, formatTime, formatDay } from "../core/utils.js";

export function mountMessageList(container) {
  container.innerHTML = `<div class="message-scroll"><div class="message-list" role="log" aria-live="polite"></div></div>`;
  const scroller = container.querySelector(".message-scroll");
  const list = container.querySelector(".message-list");
  let lastKey = "";

  const render = (state) => {
    const messages = store.getActiveMessages();
    const key = JSON.stringify(messages.map((m) => [m.id, m.pending, m.failed]));
    if (key === lastKey) return;
    lastKey = key;

    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;

    if (!messages.length) {
      list.innerHTML = `<p class="message-empty">No messages yet. Say hi.</p>`;
      return;
    }

    let lastDay = "";
    list.innerHTML = messages
      .map((m) => {
        const own = m.senderId === state.me.id;
        const day = formatDay(m.createdAt);
        const divider = day !== lastDay ? `<div class="day-divider"><span>${day}</span></div>` : "";
        lastDay = day;
        const status = m.failed
          ? `<button type="button" class="message-retry" data-retry="${escapeHtml(m.id)}">Failed · Retry</button>`
          : own
          ? `<span class="message-checks">${m.pending ? "◷" : "✓✓"}</span>`
          : "";
        return `${divider}
          <div class="message-row ${own ? "own" : "other"} ${m.pending ? "pending" : ""}">
            <div class="message-content">
              <div class="message-bubble">${escapeHtml(m.text)}</div>
              <div class="message-meta"><span>${formatTime(m.createdAt)}</span>${status}</div>
            </div>
          </div>`;
      })
      .join("");

    if (nearBottom || messages[messages.length - 1]?.senderId === state.me.id) {
      requestAnimationFrame(() => (scroller.scrollTop = scroller.scrollHeight));
    }
  };

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-retry]");
    if (btn) store.retryMessage(btn.dataset.retry);
  });

  const unsubscribe = store.subscribe(render);
  render(store.getState());
  requestAnimationFrame(() => (scroller.scrollTop = scroller.scrollHeight));
  return unsubscribe;
}
