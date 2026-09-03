"use strict";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(conversation) {
  if (conversation?.initials) {
    return conversation.initials;
  }

  return String(conversation?.name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

const icons = {
  phone: `
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2
        19.8 19.8 0 0 1-8.6-3.1
        19.5 19.5 0 0 1-6-6
        19.8 19.8 0 0 1-3.1-8.6
        A2 2 0 0 1 4.1 2h3
        a2 2 0 0 1 2 1.7
        12.8 12.8 0 0 0 .7 2.8
        2 2 0 0 1-.5 2.1L8 9.9
        a16 16 0 0 0 6 6l1.3-1.3
        a2 2 0 0 1 2.1-.5
        12.8 12.8 0 0 0 2.8.7
        2 2 0 0 1 1.8 2.1z"/>
    </svg>
  `,

  video: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <rect x="3" y="5" width="14" height="14" rx="3"/>
      <path d="m17 10 4-2v8l-4-2z"/>
    </svg>
  `,

  info: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 11v5"/>
      <path d="M12 8h.01"/>
    </svg>
  `,

  back: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  `,
};

export function createChatHeader(conversation) {
  if (!conversation) {
    return "";
  }

  const online = conversation.status === "online";

  return `
    <header class="bean-chat-header">
      <div class="bean-chat-header__identity">
        <button
          class="bean-chat-header__back"
          type="button"
          data-chat-action="back"
          aria-label="Back to conversations"
        >
          ${icons.back}
        </button>

        <button
          class="bean-chat-header__profile"
          type="button"
          data-chat-action="profile"
          aria-label="Open contact details"
        >
          <span class="bean-chat-header__avatar">
            <span class="bean-avatar">
              ${escapeHTML(getInitials(conversation))}
            </span>

            ${
              online
                ? `
                  <span
                    class="bean-chat-header__status-dot"
                    aria-hidden="true"
                  ></span>
                `
                : ""
            }
          </span>

          <span class="bean-chat-header__details">
            <span class="bean-chat-header__name">
              ${escapeHTML(conversation.name)}
            </span>

            <span class="bean-chat-header__status">
              ${
                online
                  ? "Online"
                  : escapeHTML(
                      conversation.statusText ??
                      conversation.status ??
                      ""
                    )
              }
            </span>
          </span>
        </button>
      </div>

      <div class="bean-chat-header__actions">
        <button
          class="bean-icon-button"
          type="button"
          data-chat-action="call"
          aria-label="Start voice call"
          title="Voice call"
        >
          ${icons.phone}
        </button>

        <button
          class="bean-icon-button"
          type="button"
          data-chat-action="video"
          aria-label="Start video call"
          title="Video call"
        >
          ${icons.video}
        </button>

        <button
          class="bean-icon-button"
          type="button"
          data-chat-action="details"
          aria-label="Conversation details"
          title="Details"
        >
          ${icons.info}
        </button>
      </div>
    </header>
  `;
}

export function initChatHeader(container, onAction) {
  if (!(container instanceof Element)) {
    return;
  }

  container.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("[data-chat-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.chatAction;

    if (!action) {
      return;
    }

    if (typeof onAction === "function") {
      onAction(action);
    }
  });
}
