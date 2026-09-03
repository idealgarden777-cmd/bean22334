"use strict";

/* =========================================================
   BEAN — MESSAGE LIST
   Safe rendering + date separators + attachments + reactions
   ========================================================= */

import {
  getMessages,
} from "../core/store.js";


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
   FILE ATTACHMENT
   ========================================================= */

function createFileAttachment(file) {
  if (!file) {
    return "";
  }

  const name =
    escapeHTML(
      file.name || "Attachment"
    );

  const size =
    escapeHTML(
      file.size || ""
    );

  const type =
    escapeHTML(
      file.type || ""
    );

  return `
    <div class="bean-message-file">

      <div
        class="bean-message-file__icon"
        aria-hidden="true"
      >
        📄
      </div>


      <div class="bean-message-file__info">

        <span class="bean-message-file__name">
          ${name}
        </span>

        <span class="bean-message-file__meta">
          ${size}
          ${
            size && type
              ? " · "
              : ""
          }
          ${type}
        </span>

      </div>


      <button
        class="bean-message-file__action"
        type="button"
        data-file-action="download"
        aria-label="Download ${name}"
        title="Download"
      >
        ↓
      </button>

    </div>
  `;
}


/* =========================================================
   MESSAGE META
   ========================================================= */

function createMessageMeta(
  message,
  outgoing
) {
  const time =
    escapeHTML(
      message.time || ""
    );

  return `
    <div class="bean-message__meta">

      ${
        time
          ? `
            <span class="bean-message__time">
              ${time}
            </span>
          `
          : ""
      }

      ${
        outgoing
          ? `
            <span
              class="bean-message__seen"
              aria-label="${
                message.seen
                  ? "Seen"
                  : "Sent"
              }"
              title="${
                message.seen
                  ? "Seen"
                  : "Sent"
              }"
            >
              ${
                message.seen
                  ? "✓✓"
                  : "✓"
              }
            </span>
          `
          : ""
      }

    </div>
  `;
}


/* =========================================================
   MESSAGE
   ========================================================= */

function createMessage(
  message,
  conversation
) {
  const outgoing =
    message.direction === "outgoing";

  const initials =
    escapeHTML(
      message.initials ||
      conversation?.initials ||
      getInitials(
        conversation?.name
      )
    );

  const text =
    typeof message.text === "string"
      ? message.text.trim()
      : "";

  return `
    <article
      class="
        bean-message
        ${
          outgoing
            ? "bean-message--outgoing"
            : "bean-message--incoming"
        }
      "
      data-message-id="${escapeHTML(message.id)}"
    >

      ${
        !outgoing
          ? `
            <div
              class="bean-message__avatar"
              aria-hidden="true"
            >
              ${initials}
            </div>
          `
          : ""
      }


      <div class="bean-message__body">

        ${
          text || message.file
            ? `
              <div class="bean-message__bubble">

                ${
                  text
                    ? `
                      <p class="bean-message__text">
                        ${escapeHTML(text)}
                      </p>
                    `
                    : ""
                }

                ${createFileAttachment(
                  message.file
                )}

                ${createMessageMeta(
                  message,
                  outgoing
                )}

              </div>
            `
            : ""
        }


        ${
          message.reaction
            ? `
              <div
                class="bean-message__reaction"
                aria-label="Reaction"
              >
                ${escapeHTML(
                  message.reaction
                )}
              </div>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* =========================================================
   DATE SEPARATOR
   ========================================================= */

function createDateSeparator(label) {
  return `
    <div
      class="bean-message-date"
      role="separator"
      aria-label="${escapeHTML(label)}"
    >
      <span>
        ${escapeHTML(label)}
      </span>
    </div>
  `;
}


/* =========================================================
   MESSAGE CONTENT
   ========================================================= */

function createMessagesContent(
  messages,
  conversation
) {
  let lastDate = null;

  return messages
    .map((message) => {
      const date =
        message.date || null;

      let separator = "";

      if (
        date &&
        date !== lastDate
      ) {
        separator =
          createDateSeparator(date);

        lastDate = date;
      }

      return `
        ${separator}
        ${createMessage(
          message,
          conversation
        )}
      `;
    })
    .join("");
}


/* =========================================================
   CREATE LIST
   ========================================================= */

export function createMessageList(
  conversation
) {
  if (!conversation?.id) {
    return `
      <div
        class="bean-messages"
        id="messageList"
      >
        <div class="bean-messages__empty">
          No conversation selected.
        </div>
      </div>
    `;
  }

  const messages =
    getMessages(
      conversation.id
    );

  if (messages.length === 0) {
    return `
      <div
        class="bean-messages"
        id="messageList"
        data-conversation-id="${escapeHTML(conversation.id)}"
      >
        <div class="bean-messages__empty">
          No messages yet.
        </div>
      </div>
    `;
  }

  return `
    <div
      class="bean-messages"
      id="messageList"
      data-conversation-id="${escapeHTML(conversation.id)}"
    >
      <div class="bean-messages__content">
        ${createMessagesContent(
          messages,
          conversation
        )}
      </div>
    </div>
  `;
}


/* =========================================================
   RENDER LIST
   ========================================================= */

export function renderMessageList(
  conversation
) {
  const container =
    document.getElementById(
      "messageList"
    );

  if (
    !container ||
    !conversation?.id
  ) {
    return;
  }

  const messages =
    getMessages(
      conversation.id
    );

  container.dataset.conversationId =
    conversation.id;

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="bean-messages__empty">
        No messages yet.
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="bean-messages__content">
      ${createMessagesContent(
        messages,
        conversation
      )}
    </div>
  `;

  scrollToLatestMessage();
}


/* =========================================================
   SCROLL
   ========================================================= */

export function scrollToLatestMessage() {
  const container =
    document.getElementById(
      "messageList"
    );

  if (!container) {
    return;
  }

  requestAnimationFrame(() => {
    container.scrollTop =
      container.scrollHeight;
  });
}


/* =========================================================
   COMPATIBILITY EXPORT
   ========================================================= */

export function scrollMessagesToBottom() {
  scrollToLatestMessage();
}
