"use strict";

/* =========================================================
   BEAN — COMPOSER
   Minimal pill composer
   ========================================================= */


/* =========================================================
   ICONS
   ========================================================= */

const icons = {
  plus: `
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14"/>
      <path d="M5 12h14"/>
    </svg>
  `,

  send: `
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5"/>
      <path d="m6 11 6-6 6 6"/>
    </svg>
  `,
};


/* =========================================================
   MARKUP
   ========================================================= */

export function createComposer() {
  return `
    <form
      class="bean-composer"
      id="messageComposer"
      autocomplete="off"
    >

      <button
        class="bean-composer__add"
        type="button"
        data-composer-action="add"
        aria-label="Add attachment"
        title="Add"
      >
        ${icons.plus}
      </button>


      <textarea
        class="bean-composer__input"
        id="messageInput"
        name="message"
        rows="1"
        maxlength="5000"
        placeholder="Message..."
        aria-label="Message"
      ></textarea>


      <button
        class="bean-composer__send"
        type="submit"
        aria-label="Send message"
        title="Send"
        disabled
      >
        ${icons.send}
      </button>

    </form>
  `;
}


/* =========================================================
   INITIALIZE
   ========================================================= */

export function initComposer({
  onSend,
  onAction,
} = {}) {
  const form =
    document.getElementById(
      "messageComposer"
    );

  const input =
    document.getElementById(
      "messageInput"
    );

  const sendButton =
    form?.querySelector(
      ".bean-composer__send"
    );

  if (
    !form ||
    !input ||
    !sendButton
  ) {
    return;
  }


  /* =======================================================
     UPDATE SEND STATE
     ======================================================= */

  function updateSendState() {
    const hasText =
      input.value.trim().length > 0;

    sendButton.disabled =
      !hasText;
  }


  /* =======================================================
     AUTO RESIZE
     ======================================================= */

  function resizeInput() {
    input.style.height = "auto";

    const maxHeight = 140;

    const nextHeight =
      Math.min(
        input.scrollHeight,
        maxHeight
      );

    input.style.height =
      `${nextHeight}px`;

    input.style.overflowY =
      input.scrollHeight >
      maxHeight
        ? "auto"
        : "hidden";
  }


  /* =======================================================
     SUBMIT
     ======================================================= */

  function submitMessage() {
    const text =
      input.value.trim();

    if (!text) {
      return;
    }

    if (
      typeof onSend === "function"
    ) {
      onSend(text);
    }

    input.value = "";

    resizeInput();
    updateSendState();

    input.focus();
  }


  /* =======================================================
     FORM SUBMIT
     ======================================================= */

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      submitMessage();
    }
  );


  /* =======================================================
     INPUT
     ======================================================= */

  input.addEventListener(
    "input",
    () => {
      resizeInput();
      updateSendState();
    }
  );


  /* =======================================================
     ENTER TO SEND
     SHIFT + ENTER = NEW LINE
     ======================================================= */

  input.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        submitMessage();
      }
    }
  );


  /* =======================================================
     TOOL ACTIONS
     ======================================================= */

  form.addEventListener(
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
          "[data-composer-action]"
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.composerAction;

      if (
        action &&
        typeof onAction === "function"
      ) {
        onAction(action);
      }
    }
  );


  /* =======================================================
     INITIAL STATE
     ======================================================= */

  resizeInput();
  updateSendState();
}


/* =========================================================
   FOCUS
   ========================================================= */

export function focusComposer() {
  const input =
    document.getElementById(
      "messageInput"
    );

  input?.focus();
}
