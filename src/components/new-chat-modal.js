import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml, debounce } from "../core/utils.js";

export function mountNewChat(container) {
  let open = false;

  const render = (state) => {
    const want = state.modal === "new";
    if (want === open) return;
    open = want;
    if (!open) return (container.innerHTML = "");

    let mode = "direct";
    const picked = new Map(); // username -> user

    container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-label="New chat">
          <div class="modal-header">
            <div class="segmented">
              <button type="button" class="active" data-mode="direct">Direct</button>
              <button type="button" data-mode="group">New group</button>
            </div>
            <button type="button" class="icon-btn" data-close aria-label="Close">${icons.close}</button>
          </div>
          <form class="modal-form">
            <input class="group-name" type="text" placeholder="Group name" maxlength="60" hidden />
            <div class="picked" hidden></div>
            <label class="modal-input">${icons.search}<input class="who" type="text" placeholder="Search a Bean ID, e.g. leo11" autocapitalize="none" spellcheck="false" /></label>
            <div class="modal-results"></div>
            <p class="modal-error" hidden></p>
            <button type="submit" class="btn-primary submit-btn">Start chat</button>
          </form>
        </div>
      </div>`;

    const $ = (sel) => container.querySelector(sel);
    const input = $(".who");
    const results = $(".modal-results");
    const errorEl = $(".modal-error");
    const groupName = $(".group-name");
    const pickedEl = $(".picked");
    const submitBtn = $(".submit-btn");

    const showError = (msg) => {
      errorEl.textContent = msg || "";
      errorEl.hidden = !msg;
    };

    const paintPicked = () => {
      pickedEl.hidden = mode !== "group" || !picked.size;
      pickedEl.innerHTML = [...picked.values()]
        .map((u) => `<span class="chip">${escapeHtml(u.displayName)}<button type="button" data-unpick="${escapeHtml(u.username)}" aria-label="Remove">×</button></span>`)
        .join("");
      submitBtn.textContent = mode === "group" ? `Create group${picked.size ? ` (${picked.size + 1})` : ""}` : "Start chat";
    };

    const setMode = (m) => {
      mode = m;
      container.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
      groupName.hidden = m !== "group";
      input.placeholder = m === "group" ? "Add people by Bean ID" : "Search a Bean ID, e.g. leo11";
      showError("");
      paintPicked();
      (m === "group" ? groupName : input).focus();
    };

    const search = debounce(async () => {
      const q = input.value.trim();
      if (q.length < 2) return (results.innerHTML = "");
      try {
        const users = await store.searchUsers(q);
        results.innerHTML = users.length
          ? users
              .map(
                (u) => `<button type="button" class="chat-item" data-user='${escapeHtml(JSON.stringify(u))}'>
                  ${avatar(u, "md", { online: u.online })}
                  <span class="chat-info"><strong>${escapeHtml(u.displayName)}</strong><small>${escapeHtml(u.beanId)}</small></span>
                  ${mode === "group" ? `<span class="pick-mark ${picked.has(u.username) ? "on" : ""}">${icons.check}</span>` : ""}
                </button>`
              )
              .join("")
          : `<p class="muted-note">No Bean ID found. Press Enter to try “${escapeHtml(q)}”.</p>`;
      } catch {
        results.innerHTML = "";
      }
    }, 220);

    container.querySelector(".modal-backdrop").addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-backdrop") || e.target.closest("[data-close]")) store.closeModal();
    });
    container.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
    input.addEventListener("input", () => {
      showError("");
      search();
    });
    pickedEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-unpick]");
      if (b) {
        picked.delete(b.dataset.unpick);
        paintPicked();
        search();
      }
    });
    results.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-user]");
      if (!b) return;
      const u = JSON.parse(b.dataset.user);
      if (mode === "direct") {
        try {
          await store.openDm(u.username);
        } catch (err) {
          showError(err.message);
        }
        return;
      }
      picked.has(u.username) ? picked.delete(u.username) : picked.set(u.username, u);
      paintPicked();
      input.value = "";
      results.innerHTML = "";
      input.focus();
    });

    container.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");
      submitBtn.disabled = true;
      try {
        if (mode === "direct") await store.openDm(input.value.trim());
        else await store.createGroup(groupName.value.trim(), [...picked.keys()]);
      } catch (err) {
        showError(err.message);
      } finally {
        submitBtn.disabled = false;
      }
    });

    paintPicked();
    input.focus();
  };

  store.subscribe(render);
  render(store.getState());
}
