"use strict";

/* =========================================================
   BEAN — CHAT HEADER
   Conversation identity + quick actions
   ========================================================= */


/* =========================================================
   ICONS
   ========================================================= */

const icons = {
  back: `
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
      <path d="m15 18-6-6 6-6"/>
    </svg>
  `,

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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2
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
      <rect x="3" y="5" width="14" height="14" rx="3"/>
      <path d="m17 10 4-2v8l-4-2z"/>
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
      <circle cx="11" cy="11" r="7"/>
      <path d="m20 20-4-4"/>
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
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 10v6"/>
      <path d="M12 7h.01"/>
    </svg>
  `,
};


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "B";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase();
}


/* =========================================================
   ACTION BUTTON
   ========================================================= */

function createActionButton(
  action,
  label,
  icon
) {
  return `
    <button
      type="button"
      data-chat-action="${action}"
      aria-label="${label}"
      title="${label}"
    >
      ${icon}
    </button>
  `;
}


/* =========================================================
   HEADER
   ========================================================= */

export function createChatHeader(
  conversation
) {
  if (!conversation) {
    return "";
  }

  const name =
    escapeHTML(
      conversation.name ||
      "Conversation"
    );

  const initials =
    escapeHTML(
      conversation.initials ||
      getInitials(conversation.name)
    );

  const status =
    conversation.online
      ? "Online"
      : conversation.status ||
        "Offline";

  return `
    <header class="bean-chat-header">

      <div class="bean-chat-header__left">

        <button
          class="bean-chat-header__back"
          type="button"
          data-chat-action="back"
          aria-label="Back to chats"
          title="Back"
        >
          ${icons.back}
        </button>


        <button
          class="bean-chat-header__person"
          type="button"
          data-chat-action="info"
          aria-label="Open details for ${name}"
        >

          <span class="bean-chat-header__avatar">

            ${
              conversation.avatar
                ? `
                  <img
                    src="${escapeHTML(conversation.avatar)}"
                    alt=""
                  >
                `
                : initials
            }

            ${
              conversation.online
                ? `
                  <span
                    class="bean-presence is-online"
                    aria-hidden="true"
                  ></span>
                `
                : ""
            }

          </span>


          <span class="bean-chat-header__identity">
            <strong>
              ${name}
            </strong>

            <small>
              ${escapeHTML(status)}
            </small>
          </span>

        </button>

      </div>


      <div
        class="bean-chat-header__actions"
        aria-label="Conversation actions"
      >

        ${createActionButton(
          "voice",
          "Start voice call",
          icons.phone
        )}

        ${createActionButton(
          "video",
          "Start video call",
          icons.video
        )}

        ${createActionButton(
          "search",
          "Search conversation",
          icons.search
        )}

        ${createActionButton(
          "info",
          "Conversation details",
          icons.info
        )}

      </div>

    </header>
  `;
}


/* =========================================================
   INITIALIZE
   ========================================================= */

export function initChatHeader(
  onAction
) {
  const header =
    document.querySelector(
      ".bean-chat-header"
    );

  if (!header) {
    return;
  }

  header.addEventListener(
    "click",
    (event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const button =
        target.closest(
          "[data-chat-action]"
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.chatAction;

      if (!action) {
        return;
      }

      if (
        typeof onAction ===
        "function"
      ) {
        onAction(action);
      }
    }
  );
}
