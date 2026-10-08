import { store } from "../core/store.js";
import { icons } from "./icons.js";

export function renderComposer(container) {
  container.innerHTML = `
    <form class="composer-form"><div class="composer-inner">
      <div class="composer-pill-container">
        <button type="button" class="icon-btn" disabled title="Attachments coming soon" aria-label="Attach file">${icons.paperclip}</button>
        <textarea rows="1" placeholder="Type a message..." aria-label="Message" maxlength="4000"></textarea>
        <button type="submit" class="composer-send-btn" aria-label="Send message" disabled>${icons.arrowUp}</button>
      </div>
      <p class="composer-hint">Enter to send · Shift + Enter for a new line</p>
    </div></form>`;

  const form = container.querySelector("form");
  const input = container.querySelector("textarea");
  const sendBtn = container.querySelector(".composer-send-btn");

  const resize = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
    sendBtn.disabled = !input.value.trim();
  };

  const submit = () => {
    const text = input.value.trim();
    if (!text) return;
    store.sendMessage(text);
    input.value = "";
    resize();
    input.focus();
  };

  input.addEventListener("input", resize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submit();
  });

  if (window.innerWidth > 768) input.focus();
}
