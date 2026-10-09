/* Bean dialogs: replace the browser's confirm()/prompt() boxes with in-app sheets. */
import { escapeHtml } from "../core/utils.js";

function open({ title, text = "", input = null, confirm = "OK", cancel = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "bean-dialog-backdrop";
    wrap.innerHTML = `
      <div class="bean-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bd-title" ${text ? 'aria-describedby="bd-text"' : ""}>
        <h3 id="bd-title">${escapeHtml(title)}</h3>
        ${text ? `<p id="bd-text">${escapeHtml(text)}</p>` : ""}
        ${input ? `<label class="bd-field"><input type="text" value="${escapeHtml(input.value || "")}" maxlength="${input.maxLength || 80}" placeholder="${escapeHtml(input.placeholder || "")}" aria-label="${escapeHtml(title)}" /></label>` : ""}
        <div class="bd-actions">
          <button type="button" class="bd-btn ghost" data-r="cancel">${escapeHtml(cancel)}</button>
          <button type="button" class="bd-btn ${danger ? "danger" : "primary"}" data-r="ok">${escapeHtml(confirm)}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    const field = wrap.querySelector("input");
    const okBtn = wrap.querySelector('[data-r="ok"]');
    (field || okBtn).focus();
    field?.select();

    const done = (ok) => {
      document.removeEventListener("keydown", onKey, true);
      wrap.classList.remove("show");
      setTimeout(() => wrap.remove(), 160);
      prevFocus?.focus?.();
      if (!ok) return resolve(input ? null : false);
      resolve(input ? field.value.trim() : true);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        done(false);
      } else if (e.key === "Enter" && (field ? document.activeElement === field : true)) {
        e.preventDefault();
        if (!field || field.value.trim()) done(true);
      } else if (e.key === "Tab") {
        const f = [...wrap.querySelectorAll("input, button")];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    if (field) {
      const sync = () => (okBtn.disabled = !field.value.trim());
      field.addEventListener("input", sync);
      sync();
    }
    wrap.addEventListener("click", (e) => {
      const r = e.target.closest("[data-r]")?.dataset.r;
      if (r) return done(r === "ok");
      if (e.target === wrap) done(false);
    });
  });
}

export const confirmDialog = (opts) => open(opts);
export const promptDialog = (opts) => open({ ...opts, input: opts.input || {} });
