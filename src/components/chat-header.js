"use strict";

/* =========================================================
   BEAN — CHAT HEADER
   Minimal conversation header
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
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2
        19.8 19.8 0 0 1-8.6-3.1
        19.5 19.5 0 0 1-6-6
        19.8 19.8 0 0 1-3.1-8.6
        A2 2 0 0 1 4.1 2h3
        a2 2 0 0 1 2 1.7"
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
      class="bean-chat-header__action"
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
   CREATE HEADER
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
      getInitials(
        conversation.name
      )
    );

  const online =
    conversation.status === "online";

  const status =
    online
      ? "Online"
      : "Offline";

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
              online
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
              ${status}
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
          "Voice call",
          icons.phone
        )}

        ${createActionButton(
          "video",
          "Video call",
          icons.video
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
      const target =
        event.target;

      if (
        !(target instanceof Element)
      ) {
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
