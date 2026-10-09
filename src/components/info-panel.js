import { store } from "../core/store.js";
import { icons } from "./icons.js";
import { avatar, escapeHtml, lastSeen, debounce } from "../core/utils.js";
import { openLightbox } from "./lightbox.js";
import { e2ee } from "../core/e2ee.js";

function encryptionHtml(conv, s) {
  if (conv.e2ee === false) {
    return `<section class="info-section enc-section plain"><h4>🤖 Not end-to-end encrypted</h4>
      <p class="muted-note">Neyo AI hai. Is chat ke messages jawab ke liye Google Gemini ko jaate hain. Passwords, card ya bank details yahan na likhein.</p></section>`;
  }
  if (conv.type === "group") {
    return `<section class="info-section enc-section"><h4>${icons.lock} End-to-end encrypted</h4>
      <p class="muted-note">Messages, photos, files aur voice notes sirf members ke devices par khulte hain. Koi member nikle ya naya aaye to key khud badal jaati hai. Kisi member ka safety number unki DM mein check karein.</p></section>`;
  }
  const peer = conv.peer;
  const changed = e2ee.keyChanged(peer.id);
  const verified = e2ee.isVerified(peer.id);
  return `<section class="info-section enc-section">
    <h4>${icons.lock} End-to-end encrypted ${verified ? `<span class="verified-tag">${icons.shield} Verified</span>` : ""}</h4>
    ${changed ? `<p class="enc-warn">${icons.alert} ${escapeHtml(peer.displayName)} ki security key badal gayi. <button type="button" class="link-btn" data-accept="${escapeHtml(peer.id)}">Theek hai</button></p>` : ""}
    <p class="muted-note">Safety number: ${escapeHtml(peer.displayName)} ke phone par bhi bilkul yahi number hona chahiye. Saamne mil kar ya call par milayein.</p>
    <div class="safety-number" data-safety="${escapeHtml(peer.id)}"><small>…</small></div>
    ${changed ? "" : `<button type="button" class="link-btn" data-verify="${escapeHtml(peer.id)}">${verified ? "Verified hata dein" : "Number mil gaya: Verified mark karein"}</button>`}
  </section>`;
}

export function mountInfoPanel(container) {
  let lastKey = "";

  const render = (s) => {
    const conv = store.conversation();
    const thread = store.thread();
    const urlOf = (m) => s.media[m.id] || m.attachment?.url || null;
    const media = thread.items.filter((m) => m.kind === "image" && urlOf(m) && !m.deletedAt).slice(-9).reverse();
    const files = thread.items.filter((m) => m.kind === "file" && m.attachment && !m.deletedAt).slice(-5).reverse();
    const key = JSON.stringify([conv?.id, s.panelOpen, conv?.title, conv?.muted, conv?.members.map((m) => [m.id, m.role, m.online]), media.map((m) => m.id), files.map((m) => m.id), s.keyTick]);
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
          ${!dm && admin ? `<button type="button" class="link-btn" data-action="rename">Rename group</button>` : ""}
        </div>

        <div class="info-actions">
          ${dm && !conv.peer.isBot ? `<button type="button" data-action="audio">${icons.phone}<span>Call</span></button><button type="button" data-action="video">${icons.video}<span>Video</span></button>` : ""}
          <button type="button" data-action="mute">${conv.muted ? icons.bell : icons.bellOff}<span>${conv.muted ? "Unmute" : "Mute"}</span></button>
          ${!dm && admin ? `<button type="button" data-action="add">${icons.userPlus}<span>Add</span></button>` : ""}
        </div>

        ${encryptionHtml(conv, s)}

        ${
          media.length
            ? `<section class="info-section"><h4>Photos</h4><div class="media-grid">${media
                .map((m) => `<button type="button" data-image="${escapeHtml(urlOf(m))}"><img src="${escapeHtml(urlOf(m))}" alt="" loading="lazy"/></button>`)
                .join("")}</div></section>`
            : ""
        }
        ${
          files.length
            ? `<section class="info-section"><h4>Files</h4><div class="info-list">${files
                .map((m) => m.attachment.encUrl
                  ? `<button type="button" class="info-file" data-decfile="${escapeHtml(m.id)}">${icons.file}<span>${escapeHtml(m.attachment.name)}</span></button>`
                  : `<a class="info-file" href="${escapeHtml(m.attachment.url || "#")}" target="_blank" rel="noopener">${icons.file}<span>${escapeHtml(m.attachment.name)}</span></a>`)
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
                      ${admin && m.id !== s.me.id ? `<button type="button" class="icon-btn" data-remove="${escapeHtml(m.id)}" title="Remove" aria-label="Remove">${icons.close}</button>` : ""}
                    </div>`
                  )
                  .join("")}</div>
              </section>
              <button type="button" class="danger-row" data-action="leave">${icons.logout}<span>Leave group</span></button>`
            : ""
        }
      </div>`;

    container.querySelector("[data-action=close]").onclick = () => store.togglePanel(false);
    container.querySelectorAll("[data-decfile]").forEach((b) => (b.onclick = () => store.downloadFile(b.dataset.decfile)));
    const safety = container.querySelector("[data-safety]");
    if (safety) {
      e2ee.safetyNumber(safety.dataset.safety).then((groups) => {
        safety.innerHTML = groups ? groups.map((g) => `<span>${g}</span>`).join("") : `<small>Abhi available nahi</small>`;
      }).catch(() => (safety.innerHTML = `<small>Abhi available nahi</small>`));
    }
    container.querySelector("[data-verify]")?.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.verify;
      e2ee.setVerified(id, !e2ee.isVerified(id));
      lastKey = "";
      render(store.getState());
    });
    container.querySelector("[data-accept]")?.addEventListener("click", (e) => store.acceptKey(e.currentTarget.dataset.accept));
    container.querySelector("[data-action=mute]").onclick = () => store.toggleMute();
    container.querySelector("[data-action=audio]")?.addEventListener("click", () => store.startCall("audio"));
    container.querySelector("[data-action=video]")?.addEventListener("click", () => store.startCall("video"));
    container.querySelectorAll("[data-image]").forEach((b) => (b.onclick = () => openLightbox(b.dataset.image)));
    container.querySelector("[data-action=rename]")?.addEventListener("click", () => {
      const title = prompt("Group name", conv.title);
      if (title && title.trim() && title.trim() !== conv.title) store.groupAction("rename", { title: title.trim() }).catch(() => {});
    });
    container.querySelector("[data-action=leave]")?.addEventListener("click", () => {
      if (confirm(`Leave "${conv.title}"?`)) store.leaveGroup().catch(() => {});
    });
    container.querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", () => {
        const m = conv.members.find((x) => x.id === b.dataset.remove);
        if (confirm(`Remove ${m?.displayName} from the group?`)) store.groupAction("remove_member", { userId: b.dataset.remove }).catch(() => {});
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
