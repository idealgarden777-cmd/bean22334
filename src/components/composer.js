"use strict";

/*
=========================================================
BEAN — COMPOSER
=========================================================

Owns:
- Message input UI
- Send button
- Auto-resize
- Enter to send
- Shift + Enter for new line
- Composer events

Does not own:
- Message storage
- Message rendering
- Backend
- Realtime
- Attachments
=========================================================
*/

/*
=========================================================
ICON
=========================================================
*/

const sendIcon = `
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </svg>
`;

/*
=========================================================
CREATE COMPOSER
=========================================================
*/

export function createComposer() {
  return `
    <div class="bean-composer-area">

      <form
        class="bean-composer"
        id="messageComposer"
        autocomplete="off"
      >

        <textarea
          class="bean-composer__input"
          id="messageInput"
          name="message"
          rows="1"
          maxlength="5000"
          placeholder="Message"
          aria-label="Message"
        ></textarea>

        <button
          class="bean-composer__send"
          id="messageSendButton"
          type="submit"
          aria-label="Send message"
          title="Send"
          disabled
        >
          ${sendIcon}
        </button>

      </form>

    </div>
  `;
}

/*
=========================================================
AUTO RESIZE
=========================================================
*/

function resizeInput(input) {
  input.style.height = "auto";

  const height = Math.min(
    input.scrollHeight,
    140
  );

  input.style.height = `${height}px`;
}

/*
=========================================================
SEND BUTTON STATE
=========================================================
*/

function updateSendButton(input, button) {
  const hasMessage =
    input.value.trim().length > 0;

  button.disabled = !hasMessage;
}

/*
=========================================================
RESET
=========================================================
*/

function resetComposer(input, button) {
  input.value = "";
  input.style.height = "auto";

  updateSendButton(input, button);
}

/*
=========================================================
INITIALIZE
=========================================================
*/

export function initComposer(onSend) {
  const form =
    document.getElementById("messageComposer");

  const input =
    document.getElementById("messageInput");

  const sendButton =
    document.getElementById("messageSendButton");

  if (!form || !input || !sendButton) {
    console.warn(
      "Bean: composer elements not found."
    );
    return;
  }

  /*
  =======================================================
  INPUT
  =======================================================
  */

  input.addEventListener("input", () => {
    resizeInput(input);
    updateSendButton(input, sendButton);
  });

  /*
  =======================================================
  KEYBOARD
  =======================================================
  */

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing
    ) {
      event.preventDefault();

      if (input.value.trim()) {
        form.requestSubmit();
      }
    }
  });

  /*
  =======================================================
  SUBMIT
  =======================================================
  */

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = input.value.trim();

    if (!text) {
      return;
    }

    if (typeof onSend !== "function") {
      return;
    }

    const result = onSend(text);

    /*
     * Returning false means the message
     * was not accepted.
     */
    if (result === false) {
      return;
    }

    resetComposer(
      input,
      sendButton
    );

    input.focus();
  });

  /*
  =======================================================
  INITIAL STATE
  =======================================================
  */

  resizeInput(input);
  updateSendButton(input, sendButton);
}

/*
=========================================================
FOCUS
=========================================================
*/

export function focusComposer() {
  const input =
    document.getElementById("messageInput");

  if (input) {
    input.focus();
  }
}
