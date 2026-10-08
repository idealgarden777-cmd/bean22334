import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml } from "../core/utils.js";

export function mountContactPanel(container) {
  let lastKey = "";

  const render = (state) => {
    const conv = store.getActiveConversation();
    const key = `${conv?.id}|${state.contactPanelOpen}|${(state.messages[conv?.id] || []).length}`;
    if (key === lastKey) return;
    lastKey = key;

    if (!conv) {
      container.innerHTML = "";
      return;
    }
    const { contact } = conv;
    const count = (state.messages[conv.id] || []).length;

    container.innerHTML = `
      <div class="contact-panel-header">
        <span>Contact info</span>
        <button type="button" class="icon-btn" data-action="close" aria-label="Close">${icons.close}</button>
      </div>
      <div class="contact-panel-content">
        ${avatar(contact, "lg")}
        <h3>${escapeHtml(contact.displayName)}</h3>
        <p>${escapeHtml(contact.beanId)}</p>
        <dl class="contact-facts">
          <div><dt>Bean ID</dt><dd>${escapeHtml(contact.beanId)}</dd></div>
          <div><dt>Messages</dt><dd>${count}</dd></div>
        </dl>
      </div>`;

    container.querySelector("[data-action=close]").onclick = () => store.toggleContactPanel(false);
  };

  store.subscribe(render);
  render(store.getState());
}
