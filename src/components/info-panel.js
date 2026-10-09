import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { confirmDialog, promptDialog } from "./dialog.js";
import { downloadFile } from "../core/media.js";
import { avatar, escapeHtml, lastSeen, debounce } from "../core/utils.js";
import { openLightbox } from "./lightbox.js";

export function mountInfoPanel(container) {
  let lastKey = "";

  const render = (s) => {
    const conv = store.conversation();
    const thread = store.thread();
    const media = thread.items.filter((m) => m.kind === "image" && m.attachment?.url && !m.deletedAt).slice(-9).reverse();
    const files = thread.items.filter((m) => m.kind === "file" && m.attachment && !m.deletedAt).slice(-5).reverse();
    const key = JSON.stringify([conv?.id, s.panelOpen, conv?.title, conv?.muted, conv?.members.map((m) => [m.id, m.role, m.online]), media.map((m) => m.id), files.map((m) => m.id)]);
    if (key === lastKey) return;
    lastKey = key;
    if (!conv || !s.panelOpen) {
      container.innerHTML = "";
      return;
    }

    const dm = conv.type === "dm";
    const admin = conv.myRole === "admin";
    const who = dm ? conv.peer : conv;

    container.innerHTML = `
      <div class="info-header">
        <span>${dm ? "Contact info" : "Group info"}</span>
        <button type="button" class="icon-btn" data-action="close" aria-label="Close">${icons.close}</button>
      </div>
      <div class="info-body">
        <div class="info-hero">
          ${avatar(who, "xl")}
          <h3 class="info-title">${escapeHtml(conv.title)}</h3>
          <p>${dm ? escapeHtml(conv.peer.beanId) : `Group · ${conv.members.length} members`}</p>
          ${dm ? `<p class="info-status ${conv.peer.online ? "online" : ""}">${escapeHtml(lastSeen(conv.peer))}</p>` : ""}
          ${dm && conv.peer.bio ? `<p class="info-bio">${escapeHtml(conv.peer.bio)}</p>` : ""}
          ${!dm && admin ? `<button type="button" class="link-btn" data-action="rename">Rename group</button>` : ""}
        </div>

        <div class="info-actions">
          ${dm ? `<button type="button" data-action="audio">${icons.phone}<span>Call</span></button><button type="button" data-action="video">${icons.video}<span>Video</span></button>` : ""}
          <button type="button" data-action="mute">${conv.muted ? icons.bell : icons.bellOff}<span>${conv.muted ? "Unmute" : "Mute"}</span></button>
          ${!dm && admin ? `<button type="button" data-action="add">${icons.userPlus}<span>Add</span></button>` : ""}
        </div>

        ${
          media.length
            ? `<section class="info-section"><h4>Photos</h4><div class="media-grid">${media
                .map((m) => `<button type="button" data-image="${escapeHtml(m.attachment.url)}"><img src="${escapeHtml(m.attachment.url)}" alt="" loading="lazy"/></button>`)
                .join("")}</div></section>`
            : ""
        }
        ${
          files.length
            ? `<section class="info-section"><h4>Files</h4><div class="info-list">${files
                .map((m) => `<button type="button" class="info-file" data-file="${escapeHtml(m.id)}">${icons.file}<span>${escapeHtml(m.attachment.name)}</span>${icons.download}</button>`)
                .join("")}</div></section>`
            : ""
        }

        ${
          !dm
            ? `<section class="info-section">
                <h4>${conv.members.length} members</h4>
                <div class="add-member" hidden>
                  <label class="search-pill">${icons.search}<input type="text" placeholder="Add a Bean ID" /></label>
                  <div class="add-results"></div>
                </div>
                <div class="info-list">${conv.members
                  .sort((a, b) => (a.id === s.me.id ? -1 : b.id === s.me.id ? 1 : a.role === "admin" ? -1 : 1))
                  .map(
                    (m) => `<div class="member-row">
                      ${avatar(m, "sm", { online: m.online })}
                      <span class="member-text"><strong>${escapeHtml(m.id === s.me.id ? "You" : m.displayName)}</strong><small>${escapeHtml(m.beanId)}</small></span>
                      ${m.role === "admin" ? `<span class="role-tag">Admin</span>` : ""}
                      ${admin && m.id !== s.me.id ? `<button type="button" class="icon-btn" data-remove="${escapeHtml(m.id)}" data-tip="Remove" aria-label="Remove">${icons.close}</button>` : ""}
                    </div>`
                  )
                  .join("")}</div>
              </section>
              <button type="button" class="danger-row" data-action="leave">${icons.logout}<span>Leave group</span></button>`
            : ""
        }
      </div>`;

    container.querySelector("[data-action=close]").onclick = () => store.togglePanel(false);
    container.querySelector("[data-action=mute]").onclick = () => store.toggleMute();
    container.querySelector("[data-action=audio]")?.addEventListener("click", () => store.startCall("audio"));
    container.querySelector("[data-action=video]")?.addEventListener("click", () => store.startCall("video"));
    container.querySelectorAll("[data-image]").forEach((b) => (b.onclick = () => openLightbox(b.dataset.image)));
    container.querySelectorAll("[data-file]").forEach((b) =>
      b.addEventListener("click", () => {
        const m = store.thread().items.find((x) => x.id === b.dataset.file);
        downloadFile(m?.attachment?.url, m?.attachment?.name);
      })
    );
    container.querySelector("[data-action=rename]")?.addEventListener("click", () => {
      promptDialog({ title: "Rename group", input: { value: conv.title, maxLength: 60, placeholder: "Group name" }, confirm: "Save" }).then((title) => {
        if (title && title !== conv.title) store.groupAction("rename", { title }).catch(() => {});
      });
    });
    container.querySelector("[data-action=leave]")?.addEventListener("click", () => {
      confirmDialog({ title: `Leave "${conv.title}"?`, text: "You won't get new messages from this group.", confirm: "Leave group", danger: true }).then((ok) => ok && store.leaveGroup().catch(() => {}));
    });
    container.querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", () => {
        const m = conv.members.find((x) => x.id === b.dataset.remove);
        confirmDialog({ title: `Remove ${m?.displayName || "this member"}?`, text: "They will leave the group and stop getting its messages.", confirm: "Remove", danger: true }).then(
          (ok) => ok && store.groupAction("remove_member", { userId: b.dataset.remove }).catch(() => {})
        );
      })
    );

    const addBox = container.querySelector(".add-member");
    container.querySelector("[data-action=add]")?.addEventListener("click", () => {
      addBox.hidden = !addBox.hidden;
      if (!addBox.hidden) addBox.querySelector("input").focus();
    });
    if (addBox) {
      const input = addBox.querySelector("input");
      const results = addBox.querySelector(".add-results");
      const search = debounce(async () => {
        const q = input.value.trim();
        if (q.length < 2) return (results.innerHTML = "");
        try {
          const users = (await store.searchUsers(q)).filter((u) => !conv.members.some((m) => m.id === u.id));
          results.innerHTML = users.length
            ? users.map((u) => `<button type="button" class="member-row pick" data-add="${escapeHtml(u.username)}">${avatar(u, "sm")}<span class="member-text"><strong>${escapeHtml(u.displayName)}</strong><small>${escapeHtml(u.beanId)}</small></span>${icons.plus}</button>`).join("")
            : `<p class="muted-note">No one found</p>`;
        } catch {}
      }, 250);
      input.addEventListener("input", search);
      results.addEventListener("click", (e) => {
        const b = e.target.closest("[data-add]");
        if (b) store.groupAction("add_members", { usernames: [b.dataset.add] }).catch(() => {});
      });
    }
  };

  store.subscribe(render);
  render(store.getState());
}
