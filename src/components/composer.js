"use strict";

const icons = {
  plus: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M12 5v14"/>
      <path d="M5 12h14"/>
    </svg>
  `,

  attach: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"/>
    </svg>
  `,

  emoji: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <path d="M9 9h.01"/>
      <path d="M15 9h.01"/>
    </svg>
  `,

  send: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" stroke-width="1.9"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4z"/>
      <path d="M22 2 11 13"/>
    </svg>
  `,
};

export function createComposer() {
  return `
    <form
      class="bean-composer"
      id="messageComposer"
      autocomplete="off"
    >
      <div class="bean-composer__box">
        <textarea
          class="bean-composer__input"
          id="messageInput"
          name="message"
          rows="1"
          maxlength="5000"
          placeholder="Type a message..."
          aria-label="Message"
        ></textarea>

        <div class="bean-composer__toolbar">
          <div class="bean-composer__tools">
            <button
              class="bean-composer__tool"
              type="button"
              data-composer-action="add"
              aria-label="Add"
              title="Add"
            >
              ${icons.plus}
            </button>

            <button
              class="bean-composer__tool"
              type="button"
              data-composer-action="attach"
              aria-label="Attach file"
              title="Attach file"
            >
              ${icons.attach}
            </button>

            <button
              class="bean-composer__tool"
              type="button"
              data-composer-action="emoji"
              aria-label="Emoji"
              title="Emoji"
            >
              ${icons.emoji}
            </button>
          </div>

          <button
            class="bean-composer__send"
            type="submit"
            aria-label="Send message"
            title="Send"
          >
            ${icons.send}
          </button>
        </div>
      </div>
    </form>
  `;
}

export function initComposer({
  onSend,
  onAction,
} = {}) {
  const form = document.getElementById("messageComposer");
  const input = document.getElementById("messageInput");

  if (!form || !input) {
    return;
  }

  const resizeInput = () => {
    input.style.height = "auto";

    const maxHeight = 160;

    input.style.height = `${Math.min(
      input.scrollHeight,
      maxHeight
    )}px`;

    input.style.overflowY =
      input.scrollHeight > maxHeight
        ? "auto"
        : "hidden";
  };

  const submitMessage = () => {
    const text = input.value.trim();

    if (!text) {
      return;
    }

    if (typeof onSend === "function") {
      onSend(text);
    }

    input.value = "";
    resizeInput();
    input.focus();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitMessage();
  });

  input.addEventListener("input", resizeInput);

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      submitMessage();
    }
  });

  form.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest(
      "[data-composer-action]"
    );

    if (!button) {
      return;
    }

    const action = button.dataset.composerAction;

    if (
      action &&
      typeof onAction === "function"
    ) {
      onAction(action);
    }
  });

  resizeInput();
}

export function focusComposer() {
  const input = document.getElementById("messageInput");

  input?.focus();
}
