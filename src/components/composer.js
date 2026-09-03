"use strict";

/*
=========================================================
BEAN — COMPOSER
=========================================================

Owns:
- Message composer UI
- Input resize
- Send button state
- Enter to send
- Shift + Enter for new line
- Send callback

Does not own:
- Message storage
- Message rendering
- Backend
- Realtime
=========================================================
*/


/*
=========================================================
SEND ICON
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
    <path d="M12 19V5"></path>
    <path d="M6 11l6-6 6 6"></path>
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
RESIZE INPUT
=========================================================
*/

function resizeInput(input) {
  input.style.height = "auto";

  const nextHeight = Math.min(
    input.scrollHeight,
    140
  );

  input.style.height = `${nextHeight}px`;
}


/*
=========================================================
SEND BUTTON STATE
=========================================================
*/

function updateSendButton(input, button) {
  const hasText =
    input.value.trim().length > 0;

  button.disabled = !hasText;
}


/*
=========================================================
RESET COMPOSER
=========================================================
*/

function resetComposer(input, button) {
  input.value = "";
  input.style.height = "auto";

  updateSendButton(
    input,
    button
  );
}


/*
=========================================================
INITIALIZE COMPOSER
=========================================================
*/

export function initComposer(onSend) {
  const form =
    document.getElementById("messageComposer");

  const input =
    document.getElementById("messageInput");

  const sendButton =
    document.getElementById(
      "messageSendButton"
    );


  if (
    !form ||
    !input ||
    !sendButton
  ) {
    console.warn(
      "Bean: composer elements not found."
    );

    return;
  }


  /*
  =======================================================
  INPUT CHANGE
  =======================================================
  */

  input.addEventListener(
    "input",
    () => {
      resizeInput(input);

      updateSendButton(
        input,
        sendButton
      );
    }
  );


  /*
  =======================================================
  ENTER TO SEND
  =======================================================
  */

  input.addEventListener(
    "keydown",
    (event) => {
      const shouldSend =
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing;


      if (!shouldSend) {
        return;
      }


      event.preventDefault();


      if (!input.value.trim()) {
        return;
      }


      form.requestSubmit();
    }
  );


  /*
  =======================================================
  FORM SUBMIT
  =======================================================
  */

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();


      const text =
        input.value.trim();


      if (!text) {
        return;
      }


      if (
        typeof onSend !== "function"
      ) {
        return;
      }


      const accepted =
        onSend(text);


      if (accepted === false) {
        return;
      }


      resetComposer(
        input,
        sendButton
      );
    }
  );


  /*
  =======================================================
  INITIAL STATE
  =======================================================
  */

  resizeInput(input);

  updateSendButton(
    input,
    sendButton
  );
}


/*
=========================================================
FOCUS COMPOSER
=========================================================
*/

export function focusComposer() {
  const input =
    document.getElementById(
      "messageInput"
    );


  if (!input) {
    return;
  }


  input.focus();
}
