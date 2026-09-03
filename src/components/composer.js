"use strict";

export function createComposer() {
  return `
    <div class="bean-composer-area">
      <form class="bean-composer" id="messageComposer" autocomplete="off">
        <textarea id="messageInput" rows="1" maxlength="5000" placeholder="Message" aria-label="Message"></textarea>
        <button id="messageSendButton" type="submit" aria-label="Send message" disabled>↑</button>
      </form>
    </div>
  `;
}

function resize(input) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

export function initComposer(onSend) {
  const form = document.getElementById("messageComposer");
  const input = document.getElementById("messageInput");
  const button = document.getElementById("messageSendButton");
  if (!form || !input || !button) return;

  const sync = () => {
    resize(input);
    button.disabled = !input.value.trim();
  };

  input.addEventListener("input", sync);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (input.value.trim()) form.requestSubmit();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    sync();
    onSend?.(text);
  });

  sync();
}

export function focusComposer() {
  document.getElementById("messageInput")?.focus();
}
