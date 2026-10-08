import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml } from "../core/utils.js";

export function mountNewChat(container) {
  let open = false;

  const render = (state) => {
    if (state.newChatOpen === open) return;
    open = state.newChatOpen;
    if (!open) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div class="modal-backdrop" data-action="close">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="newChatTitle">
          <div class="modal-header">
            <h2 id="newChatTitle">New chat</h2>
            <button type="button" class="icon-btn" data-action="close" aria-label="Close">${icons.close}</button>
          </div>
          <form class="modal-form">
            <label class="modal-input">
              ${icons.search}
              <input type="text" placeholder="Bean ID, e.g. leo11@bean" autocomplete="off" autocapitalize="none" />
            </label>
            <div class="modal-results"></div>
            <p class="modal-error" hidden></p>
            <button type="submit" class="btn-primary">Start chat</button>
          </form>
        </div>
      </div>`;

    const backdrop = container.querySelector(".modal-backdrop");
    const form = container.querySelector("form");
    const input = container.querySelector("input");
    const results = container.querySelector(".modal-results");
    const errorEl = container.querySelector(".modal-error");
    let timer;

    const showError = (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
    };

    const start = async (username) => {
      if (!username) return;
      showError("");
      try {
        await store.startConversation(username);
      } catch (err) {
        showError(err.message || "Could not start chat");
      }
    };

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.closest("[data-action=close]")?.classList.contains("icon-btn")) {
        store.toggleNewChat(false);
      }
    });

    input.addEventListener("input", () => {
      clearTimeout(timer);
      showError("");
      const q = input.value.trim();
      if (q.length < 2) {
        results.innerHTML = "";
        return;
      }
      timer = setTimeout(async () => {
        try {
          const users = await store.searchUsers(q);
          results.innerHTML = users
            .map(
              (u) => `
              <button type="button" class="chat-item" data-username="${escapeHtml(u.username)}">
                ${avatar(u, "sm")}
                <span class="chat-info"><strong>${escapeHtml(u.displayName)}</strong><small>${escapeHtml(u.beanId)}</small></span>
              </button>`
            )
            .join("");
        } catch {
          results.innerHTML = "";
        }
      }, 250);
    });

    results.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-username]");
      if (btn) start(btn.dataset.username);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      start(input.value.trim());
    });

    input.focus();
  };

  store.subscribe(render);
  render(store.getState());
}
