"use strict";

import { getMessages } from "../core/store.js";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createFileAttachment(file) {
  if (!file) {
    return "";
  }

  return `
    <div class="bean-message-file">
      <div class="bean-message-file__icon" aria-hidden="true">
        📄
      </div>

      <div class="bean-message-file__info">
        <span class="bean-message-file__name">
          ${escapeHTML(file.name)}
        </span>

        <span class="bean-message-file__meta">
          ${escapeHTML(file.size)}
          ${file.type ? ` · ${escapeHTML(file.type)}` : ""}
        </span>
      </div>

      <button
        class="bean-message-file__action"
        type="button"
        aria-label="Download ${escapeHTML(file.name)}"
        title="Download"
      >
        ↓
      </button>
    </div>
  `;
}

function createMessage(message) {
  const outgoing = message.direction === "outgoing";

  const classes = [
    "bean-message",
    outgoing
      ? "bean-message--outgoing"
      : "bean-message--incoming",
  ].join(" ");

  return `
    <article class="${classes}">
      ${
        !outgoing
          ? `
            <div
              class="bean-message__avatar"
              aria-hidden="true"
            >
              ${escapeHTML(message.initials ?? "B")}
            </div>
          `
          : ""
      }

      <div class="bean-message__body">
        ${
          message.text
            ? `
              <div class="bean-message__bubble">
                <p class="bean-message__text">
                  ${escapeHTML(message.text)}
                </p>

                ${createFileAttachment(message.file)}

                <div class="bean-message__meta">
                  <span class="bean-message__time">
                    ${escapeHTML(message.time)}
                  </span>

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
              </div>
            `
            : createFileAttachment(message.file)
        }

        ${
          message.reaction
            ? `
              <div class="bean-message__reaction">
                ${escapeHTML(message.reaction)}
              </div>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function createDateSeparator(label) {
  return `
    <div
      class="bean-message-date"
      role="separator"
      aria-label="${escapeHTML(label)}"
    >
      <span>${escapeHTML(label)}</span>
    </div>
  `;
}

export function createMessageList(conversationId) {
  if (!conversationId) {
    return `
      <div class="bean-messages">
        <div class="bean-messages__empty">
          No conversation selected.
        </div>
      </div>
    `;
  }

  const messages = getMessages(conversationId);

  if (messages.length === 0) {
    return `
      <div
        class="bean-messages"
        id="messageList"
        data-conversation-id="${escapeHTML(conversationId)}"
      >
        <div class="bean-messages__empty">
          No messages yet.
        </div>
      </div>
    `;
  }

  let lastDate = null;

  const content = messages
    .map((message) => {
      const date = message.date ?? null;

      let separator = "";

      if (date && date !== lastDate) {
        separator = createDateSeparator(date);
        lastDate = date;
      }

      return `
        ${separator}
        ${createMessage(message)}
      `;
    })
    .join("");

  return `
    <div
      class="bean-messages"
      id="messageList"
      data-conversation-id="${escapeHTML(conversationId)}"
    >
      <div class="bean-messages__content">
        ${content}
      </div>
    </div>
  `;
}

export function renderMessageList(conversationId) {
  const container = document.getElementById("messageList");

  if (!container) {
    return;
  }

  const messages = getMessages(conversationId);

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="bean-messages__empty">
        No messages yet.
      </div>
    `;

    return;
  }

  let lastDate = null;

  container.innerHTML = `
    <div class="bean-messages__content">
      ${messages
        .map((message) => {
          const date = message.date ?? null;

          let separator = "";

          if (date && date !== lastDate) {
            separator = createDateSeparator(date);
            lastDate = date;
          }

          return `
            ${separator}
            ${createMessage(message)}
          `;
        })
        .join("")}
    </div>
  `;

  scrollMessagesToBottom();
}

export function scrollMessagesToBottom() {
  const container = document.getElementById("messageList");

  if (!container) {
    return;
  }

  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}
