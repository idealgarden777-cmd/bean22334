"use strict";

/*
=========================================================
BEAN — CHAT HEADER
=========================================================

Owns:
- Conversation identity
- Online status
- Header action buttons
- Header action events

Does not own:
- Messages
- Composer
- Calling logic
- Search logic
- Backend
=========================================================
*/

/*
=========================================================
HELPERS
=========================================================
*/

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/*
=========================================================
ICONS
=========================================================
*/

const icons = {
  phone: `
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2
        19.79 19.79 0 0 1-8.63-3.07
        19.5 19.5 0 0 1-6-6
        19.79 19.79 0 0 1-3.07-8.67
        A2 2 0 0 1 4.11 2h3
        a2 2 0 0 1 2 1.72
        12.84 12.84 0 0 0 .7 2.81
        2 2 0 0 1-.45 2.11L8.09 9.91
        a16 16 0 0 0 6 6l1.27-1.27
        a2 2 0 0 1 2.11-.45
        12.84 12.84 0 0 0 2.81.7
        A2 2 0 0 1 22 16.92z"
      />
    </svg>
  `,

  video: `
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="13"
        height="14"
        rx="2"
      />
      <path d="m16 10 5-3v10l-5-3z" />
    </svg>
  `,

  search: `
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  `,

  info: `
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  `,
};

/*
=========================================================
ACTION BUTTON
=========================================================
*/

function createActionButton({
  action,
  label,
  icon,
}) {
  return `
    <button
      class="bean-chat-header__action"
      type="button"
      data-chat-header-action="${action}"
      aria-label="${label}"
      title="${label}"
    >
      ${icon}
    </button>
  `;
}

/*
=========================================================
CREATE HEADER
=========================================================
*/

export function createChatHeader(conversation) {
  if (!conversation) {
    return "";
  }

  const name = escapeHTML(conversation.name);
  const initials = escapeHTML(conversation.initials);

  return `
    <header class="bean-chat-header">

      <div class="bean-chat-header__person">

        <button
          class="bean-chat-header__profile"
          type="button"
          data-chat-header-action="profile"
          aria-label="Open ${name} profile"
        >

          <span
            class="bean-avatar bean-chat-header__avatar"
            aria-hidden="true"
          >
            ${initials}
          </span>

          <span class="bean-chat-header__info">

            <span class="bean-chat-header__name">
              ${name}
            </span>

            <span class="bean-chat-header__status">
              <span
                class="bean-chat-header__status-dot"
                aria-hidden="true"
              ></span>

              Online
            </span>

          </span>

        </button>

      </div>

      <div
        class="bean-chat-header__actions"
        aria-label="Conversation actions"
      >

        ${createActionButton({
          action: "voice",
          label: "Voice call",
          icon: icons.phone,
        })}

        ${createActionButton({
          action: "video",
          label: "Video call",
          icon: icons.video,
        })}

        ${createActionButton({
          action: "search",
          label: "Search conversation",
          icon: icons.search,
        })}

        ${createActionButton({
          action: "info",
          label: "Conversation details",
          icon: icons.info,
        })}

      </div>

    </header>
  `;
}

/*
=========================================================
HEADER EVENTS
=========================================================
*/

export function initChatHeader(onAction) {
  const header =
    document.querySelector(".bean-chat-header");

  if (!header) {
    return;
  }

  header.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest(
      "[data-chat-header-action]"
    );

    if (!button) {
      return;
    }

    const action =
      button.dataset.chatHeaderAction;

    if (!action) {
      return;
    }

    if (typeof onAction === "function") {
      onAction(action);
    }
  });
}
