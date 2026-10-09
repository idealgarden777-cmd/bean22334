/* =========================================================
 * Bean store — app state, sync loop and every user action.
 * ========================================================= */
import { api } from "./api.js";
import { CallSession } from "./call.js";
import { e2ee, E2EEError } from "./e2ee.js";
import { keyStore } from "./keystore.js";
import {
  playMessageSound, startRinging, stopRinging, showNotification, setTitleBadge,
  notificationPermission, askNotificationPermission,
} from "./notify.js";

const VISIBLE_MS = 2500;
const HIDDEN_MS = 7000;
const OVERLAP_MS = 3000;
const RING_TIMEOUT_MS = 45000;

const byCreated = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
const tempId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const store = {
  state: {
    status: "loading", // loading | signedOut | locked | ready | error
    lockMode: null, // password | oldlock | reset (unlock screen)
    build: null,
    media: {}, // messageId -> decrypted blob URL (photos, voice notes, files)
    keyTick: 0, // bumps when a contact key / safety number state changes
    error: null,
    me: null,
    settings: { messageTimer: 0, wallpaper: "none", ghostEnabled: false, ghostNote: "", ghostUntil: null },
    view: "home", // home | beanbox (unread)
    conversations: [],
    threads: {}, // convId -> { items, hasMore, loaded, loading }
    activeId: null,
    search: "",
    panelOpen: false,
    modal: null, // null | "new" | "settings"
    unsending: {}, // messageId -> true while the Undo toast is up
    replyTo: null,
    editing: null,
    typing: {}, // convId -> [userId]
    reads: {}, // convId -> { userId: iso }
    uploads: [], // { id, conversationId, name, progress }
    call: null,
    incomingCall: null,
    toast: null, // string | { text, action, onAction }
    notifPermission: notificationPermission(),
  },

  listeners: new Set(),
  since: {},
  tick: 0,
  timer: null,
  knownUnread: null,
  dismissedCalls: new Set(),
  session: null,
  lastTypingSent: 0,

  getState() {
    return this.state;
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  },

  /* ---------------- selectors ---------------- */

  conversation(id = this.state.activeId) {
    return this.state.conversations.find((c) => c.id === id) || null;
  },
  thread(id = this.state.activeId) {
    return this.state.threads[id] || { items: [], hasMore: false, loaded: false, loading: false };
  },
  userName(id, conv = this.conversation()) {
    if (id === this.state.me?.id) return "You";
    return conv?.members?.find((m) => m.id === id)?.displayName || "Someone";
  },
  filteredConversations() {
    const q = this.state.search.trim().toLowerCase();
    const base =
      this.state.view === "beanbox"
        ? this.state.conversations.filter((c) => c.unread > 0 && c.id !== this.state.activeId)
        : this.state.conversations;
    if (!q) return base;
    return base.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.members.some((m) => m.username.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q))
    );
  },

  /* ---------------- boot ---------------- */

  async init() {
    let res;
    try {
      res = await api.me();
    } catch (err) {
      if (err.code !== "NO_API") return this.set({ status: "error", error: err.message });
      api.enableDemo();
      res = await api.me();
    }
    if (!res.authenticated) return this.set({ status: "signedOut" });
    this.set({ me: res.user, settings: { ...this.state.settings, ...(res.settings || {}) }, build: res.build || null });
    e2ee.onChange(() => this.set({ keyTick: this.state.keyTick + 1 }));

    // One password for everything: the login password also unlocks the encryption key (no extra screen).
    let once = null;
    try {
      once = sessionStorage.getItem("bean_unlock_once");
      sessionStorage.removeItem("bean_unlock_once");
    } catch {}
    try {
      const lock = await e2ee.status(res.user);
      if (lock !== "ready") {
        if (once) {
          this.set({ status: "loading" });
          try {
            await this.unlockWithPassword(once, { verified: true });
            return;
          } catch (err) {
            if (err.code !== "SWITCHED") throw err; // backup still uses an older separate Chat Lock: ask once
            return this.set({ status: "locked", lockMode: "oldlock" });
          }
        }
        return this.set({ status: "locked", lockMode: "password" });
      }
    } catch (err) {
      return this.set({ status: "error", error: err.message });
    }
    return this.boot();
  },

  /* ---------------- Chat Lock ---------------- */

  /* Unlock (or first-time set up) this device's chats with the Bean password. */
  async unlockWithPassword(password, { verified = false } = {}) {
    if (!e2ee.record) {
      if (!verified) {
        const { ok } = await api.verifyPassword(password);
        if (!ok) throw Object.assign(new Error("Password galat hai"), { code: "BAD_PASSWORD" });
      }
      await e2ee.setup(password);
      return this.boot();
    }
    try {
      await e2ee.unlock(password);
    } catch (err) {
      if (err.code !== "WRONG_PASSPHRASE") throw err;
      // right Bean password but the backup still uses an older separate Chat Lock?
      const ok = verified || (await api.verifyPassword(password)).ok;
      if (!ok) throw Object.assign(new Error("Password galat hai"), { code: "BAD_PASSWORD" });
      this.loginPassword = password;
      this.set({ lockMode: "oldlock" });
      throw Object.assign(new Error(""), { code: "SWITCHED" });
    }
    return this.boot();
  },
  /* Older separate Chat Lock: open with it once, then move the backup onto the Bean password. */
  async unlockOldLock(oldLock) {
    await e2ee.unlock(oldLock);
    if (this.loginPassword) {
      try {
        await e2ee.saveBackup(await e2ee.resealBackup(oldLock, this.loginPassword));
      } catch {}
      this.loginPassword = null;
    }
    return this.boot();
  },
  /* Bean password change keeps the same key: the backup is re-sealed with the new password. */
  async changePassword({ displayName, currentPassword, password }) {
    let resealed = null;
    try {
      resealed = await e2ee.resealBackup(currentPassword, password);
    } catch (err) {
      if (!["WRONG_PASSPHRASE", "NO_KEY"].includes(err.code)) throw err;
    }
    const res = await this.updateSettings({ displayName, password, currentPassword });
    if (resealed) {
      try {
        await e2ee.saveBackup(resealed);
      } catch {
        this.toast("Password badal gaya, lekin chat backup update nahi hua. Dobara try karein.");
      }
    }
    return res;
  },

  async resetWithPassword(password) {
    const { ok } = await api.verifyPassword(password);
    if (!ok) throw Object.assign(new Error("Password galat hai"), { code: "BAD_PASSWORD" });
    await e2ee.setup(password, { reset: true });
    return this.boot();
  },

  async setupLock(passphrase) {
    await e2ee.setup(passphrase);
    return this.boot();
  },
  async unlock(passphrase) {
    await e2ee.unlock(passphrase);
    return this.boot();
  },
  async resetLock(passphrase) {
    await e2ee.setup(passphrase, { reset: true });
    return this.boot();
  },
  setLockMode(lockMode) {
    this.set({ lockMode });
  },
  async changeLock(oldPass, newPass) {
    await e2ee.changeLock(oldPass, newPass);
    this.toast("Updated");
  },
  async lockThisDevice() {
    await e2ee.lockDevice();
    location.reload();
  },

  async boot() {
    if (this.booted) return;
    this.booted = true;
    this.set({ status: "loading" });
    await e2ee.loadAllWraps().catch(() => {});
    try {
      const { conversations } = await api.conversations();
      const decorated = await this.decorate(conversations);
      this.knownUnread = Object.fromEntries(decorated.map((c) => [c.id, c.unread]));
      this.set({ conversations: decorated, status: "ready" });
      this.updateBadge();
    } catch (err) {
      return this.set({ status: "error", error: err.message });
    }

    const fromHash = location.hash.slice(1);
    if (fromHash && this.conversation(fromHash)) this.selectConversation(fromHash);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.syncNow();
    });
    window.addEventListener("pagehide", () => this.pendingUnsend?.commit());
    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      if (id !== (this.state.activeId || "")) id ? this.selectConversation(id) : this.closeChat();
    });
    this.loop();
    // Neyo: reminders, digests, Away Mode auto-off while Bean is open
    const tick = () => api.neyoTick().catch(() => {});
    setTimeout(tick, 4000);
    setInterval(tick, 60000);
  },

  /* ---------------- E2EE: decrypt what the server sent ---------------- */

  previews: new Map(), // last message id -> decrypted preview

  async decorate(conversations) {
    return Promise.all(
      conversations.map(async (c) => {
        if (!c.lastEnc) return c;
        if (!this.previews.has(c.lastEnc.id)) {
          const text = await e2ee.previewOf(c).catch(() => "🔒 Encrypted message");
          if (!/^🔒/.test(text)) this.previews.set(c.lastEnc.id, text);
          return { ...c, lastMessage: text };
        }
        return { ...c, lastMessage: this.previews.get(c.lastEnc.id) };
      })
    );
  },

  async open(list) {
    const out = await Promise.all((list || []).map((m) => (m.enc || m.replyTo?.enc || m.encReactions?.length ? e2ee.openMessage(m) : m)));
    for (const m of out) this.loadMedia(m, false);
    return out;
  },

  /* photos + voice notes decrypt right away, files when tapped */
  async loadMedia(m, force = true) {
    const a = m?.attachment;
    if (!a?.encUrl || !a.k || this.state.media[m.id] || this.mediaLoading?.has(m.id)) return this.state.media[m?.id];
    if (!force && !["image", "audio"].includes(m.kind)) return null;
    (this.mediaLoading ||= new Set()).add(m.id);
    try {
      const url = await e2ee.decryptMedia(a);
      this.set({ media: { ...this.state.media, [m.id]: url } });
      return url;
    } catch {
      if (force) this.toast("File decrypt nahi ho saki");
      return null;
    } finally {
      this.mediaLoading.delete(m.id);
    }
  },

  async downloadFile(id) {
    const m = this.thread().items.find((x) => x.id === id);
    if (!m) return;
    const url = this.state.media[id] || (await this.loadMedia(m, true));
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = m.attachment?.name || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  /* contact key changed: user confirms, then everything re-decrypts */
  async acceptKey(userId) {
    e2ee.acceptKey(userId);
    const cid = this.state.activeId;
    if (cid) {
      await e2ee.loadConv(cid, { force: true }).catch(() => {});
      await this.reloadThread(cid);
    }
  },

  async reloadThread(cid) {
    try {
      const { messages, hasMore } = await api.messages(cid);
      const opened = await this.open(messages);
      this.set({ threads: { ...this.state.threads, [cid]: { items: [], hasMore, loaded: false, loading: false } } });
      this.mergeMessages(cid, opened, { hasMore, prepend: true });
    } catch {}
  },

  isDemo() {
    return api.isDemo();
  },

  /* ---------------- sync loop ---------------- */

  loop() {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      await this.syncOnce();
      this.loop();
    }, document.hidden ? HIDDEN_MS : VISIBLE_MS);
  },

  syncNow() {
    clearTimeout(this.timer);
    this.syncOnce().finally(() => this.loop());
  },

  async syncOnce() {
    if (this.state.status !== "ready" || this.syncing) return;
    this.syncing = true;
    this.tick += 1;
    const active = this.state.activeId;
    const wantLists = !active || this.tick % 2 === 0;
    try {
      const res = await api.sync({
        active: active || undefined,
        since: active ? this.since[active] : undefined,
        read: active && !document.hidden ? "1" : undefined,
        lists: wantLists ? "1" : undefined,
      });

      if (res.active && res.active.conversationId === this.state.activeId) {
        const cid = res.active.conversationId;
        this.since[cid] = new Date(new Date(res.now).getTime() - OVERLAP_MS).toISOString();
        this.mergeMessages(cid, await this.open(res.active.messages), { fromSync: true });
        this.set({
          typing: { ...this.state.typing, [cid]: res.active.typing },
          reads: { ...this.state.reads, [cid]: res.active.reads },
        });
      }
      if (res.conversations) this.applyConversations(await this.decorate(res.conversations));
      this.handleIncomingCall(res.incomingCall);
    } catch (err) {
      if (err.status === 401) this.set({ status: "signedOut" });
    } finally {
      this.syncing = false;
    }
  },

  applyConversations(conversations) {
    const prev = this.knownUnread || {};
    const active = this.state.activeId;
    for (const c of conversations) {
      const before = prev[c.id] ?? c.unread;
      const isActiveVisible = c.id === active && !document.hidden;
      if (c.unread > before && !c.muted && !isActiveVisible && c.lastSenderId !== this.state.me.id) {
        playMessageSound();
        const who = c.type === "group" ? `${this.userName(c.lastSenderId, c)}: ` : "";
        showNotification(c.title, `${who}${c.lastMessage}`, () => this.selectConversation(c.id));
      }
    }
    this.knownUnread = Object.fromEntries(conversations.map((c) => [c.id, c.unread]));
    if (active && !document.hidden) {
      conversations = conversations.map((c) => (c.id === active ? { ...c, unread: 0 } : c));
    }
    this.set({ conversations });
    if (active && !conversations.some((c) => c.id === active)) this.closeChat();
    this.updateBadge();
  },

  updateBadge() {
    setTitleBadge(this.state.conversations.filter((c) => !c.muted).reduce((n, c) => n + (c.unread || 0), 0));
  },

  mergeMessages(cid, incoming, { fromSync = false, prepend = false, hasMore } = {}) {
    const thread = this.thread(cid);
    const items = [...thread.items];
    const index = new Map(items.map((m, i) => [m.id, i]));
    const hasPending = items.some((m) => m.pending);
    let changed = false;
    let newFromOthers = false;

    for (const m of incoming) {
      const i = index.get(m.id);
      if (i !== undefined) {
        if (items[i].updatedAt !== m.updatedAt || (items[i].decryptError && !m.decryptError)) {
          items[i] = m;
          changed = true;
        }
        continue;
      }
      // our own message arrived via sync before the send call returned: let send() place it
      if (fromSync && hasPending && m.senderId === this.state.me.id) continue;
      items.push(m);
      index.set(m.id, items.length - 1);
      changed = true;
      if (fromSync && m.senderId !== this.state.me.id) newFromOthers = true;
    }

    if (!changed && hasMore === undefined) return;
    items.sort(byCreated);
    this.set({
      threads: {
        ...this.state.threads,
        [cid]: { ...thread, items, loaded: true, loading: false, hasMore: hasMore ?? thread.hasMore },
      },
    });
    if (newFromOthers && document.hidden) {
      const conv = this.conversation(cid);
      if (conv && !conv.muted) playMessageSound();
    }
    if (!prepend) this.bumpConversation(cid, items[items.length - 1]);
  },

  bumpConversation(cid, last) {
    if (!last) return;
    const preview =
      last.deletedAt ? "Message deleted" :
      last.kind === "image" ? "📷 Photo" :
      last.kind === "audio" ? "🎤 Voice message" :
      last.kind === "file" ? `📎 ${last.attachment?.name || "File"}` : last.text;
    const conversations = this.state.conversations
      .map((c) =>
        c.id === cid
          ? { ...c, lastMessage: preview, lastSenderId: last.senderId, updatedAt: last.createdAt > c.updatedAt ? last.createdAt : c.updatedAt }
          : c
      )
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    this.set({ conversations });
  },

  /* ---------------- navigation ---------------- */

  async selectConversation(id) {
    if (!this.conversation(id)) return;
    if (location.hash.slice(1) !== id) history.replaceState(null, "", `#${id}`);
    const conversations = this.state.conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c));
    this.set({ activeId: id, replyTo: null, editing: null, conversations, panelOpen: this.state.panelOpen && window.innerWidth > 1100 });
    this.updateBadge();
    const opened = this.conversation(id);
    if (opened?.e2ee !== false) e2ee.keysFor(opened.members.map((m) => m.id), { maxAge: 10000 }).catch(() => {});

    if (!this.thread(id).loaded) {
      this.set({ threads: { ...this.state.threads, [id]: { ...this.thread(id), loading: true } } });
      try {
        const { messages, hasMore } = await api.messages(id);
        this.mergeMessages(id, await this.open(messages), { hasMore, prepend: true });
        if (!messages.length) {
          this.set({ threads: { ...this.state.threads, [id]: { items: [], hasMore: false, loaded: true, loading: false } } });
        }
      } catch (err) {
        this.toast(err.message);
      }
    }
    api.conversationAction("read", { conversationId: id }).catch(() => {});
    this.syncNow();
  },

  closeChat() {
    if (location.hash) history.replaceState(null, "", location.pathname);
    this.set({ activeId: null, panelOpen: false, replyTo: null, editing: null });
  },

  async loadOlder() {
    const id = this.state.activeId;
    const t = this.thread(id);
    if (!id || !t.hasMore || t.loading || !t.items.length) return;
    this.set({ threads: { ...this.state.threads, [id]: { ...t, loading: true } } });
    try {
      const { messages, hasMore } = await api.messages(id, t.items[0].createdAt);
      this.mergeMessages(id, await this.open(messages), { hasMore, prepend: true });
    } catch (err) {
      this.toast(err.message);
      this.set({ threads: { ...this.state.threads, [id]: { ...this.thread(id), loading: false } } });
    }
  },

  setSearch(search) {
    this.set({ search });
  },
  togglePanel(open = !this.state.panelOpen) {
    this.set({ panelOpen: open });
  },
  openModal(modal) {
    this.set({ modal });
  },
  closeModal() {
    this.set({ modal: null });
  },

  toast(message, ms = 3200) {
    clearTimeout(this.toastTimer);
    this.set({ toast: message });
    this.toastTimer = setTimeout(() => this.set({ toast: null }), ms);
  },

  setView(view) {
    this.set({ view });
  },

  /* ---------------- settings ("Update Identity") ---------------- */

  async updateSettings(changes) {
    const res = await api.updateMe(changes);
    this.set({
      me: res.user ? { ...this.state.me, ...res.user } : this.state.me,
      settings: { ...this.state.settings, ...(res.settings || {}) },
    });
    return res;
  },

  async enableNotifications() {
    const p = await askNotificationPermission();
    this.set({ notifPermission: p });
  },

  /* ---------------- composing ---------------- */

  setReply(message) {
    this.set({ replyTo: message, editing: null });
  },
  setEditing(message) {
    this.set({ editing: message, replyTo: null });
  },
  cancelCompose() {
    this.set({ replyTo: null, editing: null });
  },

  notifyTyping() {
    const now = Date.now();
    if (!this.state.activeId || now - this.lastTypingSent < 3000) return;
    this.lastTypingSent = now;
    api.typing(this.state.activeId).catch(() => {});
  },

  pushTemp(cid, temp) {
    const t = this.thread(cid);
    this.set({ threads: { ...this.state.threads, [cid]: { ...t, loaded: true, items: [...t.items, temp] } } });
    this.bumpConversation(cid, temp);
  },

  settleTemp(cid, id, real) {
    const t = this.thread(cid);
    let items = t.items;
    if (real && items.some((m) => m.id === real.id)) items = items.filter((m) => m.id !== id);
    else items = items.map((m) => (m.id === id ? real || { ...m, pending: false, failed: true } : m));
    this.set({ threads: { ...this.state.threads, [cid]: { ...t, items } } });
  },

  async send({ text = "", attachment = null, file = null, duration = null }) {
    const cid = this.state.activeId;
    if (!cid) return;
    const clean = text.trim();
    if (!clean && !attachment && !file) return;

    const replyTo = this.state.replyTo;
    const id = tempId();
    const now = new Date().toISOString();
    const localUrl = file ? URL.createObjectURL(file) : null;
    const temp = {
      id,
      conversationId: cid,
      senderId: this.state.me.id,
      kind: file ? (file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file") : "text",
      text: clean,
      attachment: file ? { url: localUrl, name: file.name, size: file.size, mime: file.type, duration } : null,
      replyTo: replyTo ? { id: replyTo.id, senderId: replyTo.senderId, kind: replyTo.kind, text: replyTo.text || "Attachment" } : null,
      reactions: [],
      expiresAt: this.state.settings.messageTimer ? new Date(Date.now() + this.state.settings.messageTimer * 1000).toISOString() : null,
      createdAt: now,
      updatedAt: now,
      pending: true,
      retry: { text: clean, file, duration, replyToId: replyTo?.id || null },
    };
    this.set({ replyTo: null });
    this.pushTemp(cid, temp);
    this.lastTypingSent = 0;

    const conv = this.conversation(cid);
    const secure = conv?.e2ee !== false; // every chat except the Neyo chat
    try {
      if (secure) await e2ee.sendKey(conv); // fail fast (missing / changed keys) before uploading
      let att = attachment;
      let fileMeta = null;
      if (file) {
        const upId = id;
        this.set({ uploads: [...this.state.uploads, { id: upId, conversationId: cid, name: file.name, progress: 0 }] });
        let toSend = file;
        if (secure) {
          const sealed = await e2ee.encryptFile(file);
          toSend = new File([sealed.blob], "encrypted.bin", { type: "application/octet-stream" });
          fileMeta = { name: file.name, mime: file.type || "application/octet-stream", size: file.size, duration: duration || null, k: sealed.k, iv: sealed.iv };
        }
        att = await api.upload(cid, toSend, (p) =>
          this.set({ uploads: this.state.uploads.map((u) => (u.id === upId ? { ...u, progress: p } : u)) })
        );
        if (duration && !secure) att.duration = duration;
        this.set({ uploads: this.state.uploads.filter((u) => u.id !== upId) });
      }
      let payload;
      if (secure) {
        const enc = await e2ee.encryptMessage(conv, { t: temp.kind, x: clean, ...(fileMeta ? { a: fileMeta } : {}) });
        payload = { conversationId: cid, enc, attachment: att ? { path: att.path, size: att.size } : null, replyTo: replyTo?.id || null, clientId: id };
      } else {
        payload = { conversationId: cid, text: clean, attachment: att, replyTo: replyTo?.id || null, clientId: id };
      }
      const { message: raw } = await api.messageAction("send", payload);
      const [message] = await this.open([raw]);
      if (localUrl && message.attachment) {
        message.attachment.url ||= localUrl;
        this.set({ media: { ...this.state.media, [message.id]: localUrl } });
      }
      this.settleTemp(cid, id, message);
      this.askNeyo(cid, clean);
    } catch (err) {
      this.set({ uploads: this.state.uploads.filter((u) => u.id !== id) });
      this.settleTemp(cid, id, null);
      this.toast(err.message || "Message not sent", err instanceof E2EEError ? 6000 : 3200);
    }
  },

  /* Neyo answers only in its own chat (the one chat that is not end-to-end encrypted) */
  askNeyo(cid, text) {
    const c = this.conversation(cid);
    if (!c || !text || c.e2ee !== false || !c.peer?.isBot) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const run = (retry) =>
      api.neyoReply(cid, tz).then(() => {
        this.syncNow?.();
        this.refreshSettings(); // Neyo may have turned Away Mode on/off
      }).catch((err) => {
        if (retry && (!err.status || err.status >= 500)) setTimeout(() => run(false), 1500);
      });
    run(true);
  },

  async refreshSettings() {
    try {
      const res = await api.me();
      if (res.authenticated) this.set({ settings: { ...this.state.settings, ...(res.settings || {}) } });
    } catch {}
  },

  async setGhost(changes) {
    const wasOn = this.state.settings.ghostEnabled;
    await this.updateSettings(changes);
    const on = this.state.settings.ghostEnabled;
    if (on && !wasOn) this.toast("👻 Away Mode on");
    if (!on && wasOn) this.toast("Welcome back! Report Neyo ki chat mein hai");
  },

  openNeyo() {
    return this.openDm("neyo").catch((err) => this.toast(err.message || "Neyo is not available yet"));
  },

  sendText(text) {
    if (this.state.editing) return this.saveEdit(text);
    return this.send({ text });
  },

  sendFiles(files) {
    const list = [...files].slice(0, 10);
    for (const file of list) {
      if (file.size > 25 * 1024 * 1024) {
        this.toast(`${file.name} is over 25 MB`);
        continue;
      }
      this.send({ file });
    }
  },

  sendVoice(blob, duration) {
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });
    return this.send({ file, duration });
  },

  retry(id) {
    const cid = this.state.activeId;
    const msg = this.thread(cid).items.find((m) => m.id === id);
    if (!msg?.retry) return;
    const t = this.thread(cid);
    this.set({ threads: { ...this.state.threads, [cid]: { ...t, items: t.items.filter((m) => m.id !== id) } } });
    const reply = msg.retry.replyToId ? t.items.find((m) => m.id === msg.retry.replyToId) : null;
    if (reply) this.set({ replyTo: reply });
    this.send({ text: msg.retry.text, file: msg.retry.file, duration: msg.retry.duration });
  },

  async messageAction(action, payload) {
    try {
      const { message: raw } = await api.messageAction(action, payload);
      const [message] = await this.open([raw]);
      this.mergeMessages(message.conversationId, [message]);
      return message;
    } catch (err) {
      this.toast(err.message);
    }
  },

  async saveEdit(text) {
    const msg = this.state.editing;
    const clean = text.trim();
    this.set({ editing: null });
    if (!msg || !clean || clean === msg.text) return;
    const conv = this.conversation(msg.conversationId);
    if (conv?.e2ee !== false) {
      if (!msg.encrypted) return this.toast("Purane (not encrypted) messages edit nahi ho sakte");
      try {
        const enc = await e2ee.encryptMessage(conv, { t: "text", x: clean });
        await this.messageAction("edit", { messageId: msg.id, enc });
      } catch (err) {
        this.toast(err.message);
      }
      return;
    }
    await this.messageAction("edit", { messageId: msg.id, text: clean });
  },

  deleteMessage(id) {
    return this.messageAction("delete", { messageId: id });
  },

  /* Unsend: hide at once, show "Message unsent · Undo" for 5s, then delete for everyone. */
  unsend(id) {
    const UNDO_MS = 5000;
    if (this.pendingUnsend) this.pendingUnsend.commit();
    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      this.pendingUnsend = null;
      const unsending = { ...this.state.unsending };
      delete unsending[id];
      this.set({ unsending });
      if (commit) this.deleteMessage(id);
    };
    const timer = setTimeout(() => finish(true), UNDO_MS);
    this.pendingUnsend = { commit: () => finish(true) };
    this.set({ unsending: { ...this.state.unsending, [id]: true } });
    this.toast({ text: "Message unsent", action: "Undo", onAction: () => {
      finish(false);
      this.set({ toast: null });
    } }, UNDO_MS);
  },

  react(id, emoji) {
    // optimistic toggle
    const cid = this.state.activeId;
    const me = this.state.me.id;
    const t = this.thread(cid);
    const items = t.items.map((m) => {
      if (m.id !== id) return m;
      const mine = m.reactions.find((r) => r.userIds.includes(me));
      let reactions = m.reactions.map((r) => ({ ...r, userIds: r.userIds.filter((u) => u !== me) })).filter((r) => r.userIds.length);
      if (mine?.emoji !== emoji) {
        const r = reactions.find((x) => x.emoji === emoji);
        if (r) r.userIds = [...r.userIds, me];
        else reactions = [...reactions, { emoji, userIds: [me] }];
      }
      return { ...m, reactions };
    });
    this.set({ threads: { ...this.state.threads, [cid]: { ...t, items } } });
    const conv = this.conversation(cid);
    const original = t.items.find((m) => m.id === id);
    if (conv?.e2ee === false || !original?.encrypted) {
      if (conv?.e2ee !== false && original && !original.encrypted) {
        // old plaintext message in an encrypted chat: the reaction itself is still encrypted
      } else return this.messageAction("react", { messageId: id, emoji });
    }
    const mine = original?.reactions.find((r) => r.userIds.includes(me));
    if (mine?.emoji === emoji) return this.messageAction("react", { messageId: id, remove: true });
    return e2ee
      .encryptReaction(conv, id, emoji)
      .then((enc) => this.messageAction("react", { messageId: id, enc }))
      .catch((err) => this.toast(err.message));
  },

  /* ---------------- conversations ---------------- */

  upsertConversation(conversation) {
    if (!conversation) return;
    const rest = this.state.conversations.filter((c) => c.id !== conversation.id);
    this.set({ conversations: [conversation, ...rest].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) });
  },

  async searchUsers(q) {
    const { users } = await api.searchUsers(q);
    return users;
  },

  async openDm(username) {
    const { conversation } = await api.conversationAction("open_dm", { username });
    this.upsertConversation(conversation);
    this.closeModal();
    await this.selectConversation(conversation.id);
  },

  async createGroup(title, usernames) {
    const { conversation } = await api.conversationAction("create_group", { title, usernames });
    this.upsertConversation(conversation);
    this.closeModal();
    await this.selectConversation(conversation.id);
  },

  async groupAction(action, payload) {
    try {
      const res = await api.conversationAction(action, { conversationId: this.state.activeId, ...payload });
      if (res.conversation) this.upsertConversation(res.conversation);
      this.syncNow();
      return res;
    } catch (err) {
      this.toast(err.message);
      throw err;
    }
  },

  async leaveGroup() {
    const id = this.state.activeId;
    await this.groupAction("leave");
    this.closeChat();
    this.set({ conversations: this.state.conversations.filter((c) => c.id !== id) });
  },

  async toggleMute() {
    const conv = this.conversation();
    if (!conv) return;
    const muted = !conv.muted;
    this.upsertConversation({ ...conv, muted });
    this.updateBadge();
    await api.conversationAction("mute", { conversationId: conv.id, muted }).catch((e) => this.toast(e.message));
  },

  /* ---------------- calls ---------------- */

  callSnapshot(session) {
    return {
      id: session.call.id,
      kind: session.call.kind,
      role: session.call.role,
      peer: session.call.peer,
      status: session.call.status,
      connectedAt: session.connectedAt,
      muted: session.muted,
      cameraOff: session.cameraOff,
      localStream: session.localStream,
      remoteStream: session.remoteStream,
    };
  },

  attachSession(session) {
    this.session = session;
    session.onUpdate = (s) => {
      if (s.connectedAt) stopRinging();
      this.set({ call: this.callSnapshot(s) });
    };
    session.onEnd = (reason) => {
      stopRinging();
      clearTimeout(this.ringTimeout);
      this.session = null;
      const label = { declined: "Call declined", missed: "No answer", failed: "Call dropped" }[reason];
      if (label) this.toast(label);
      this.set({ call: null });
      this.syncNow();
    };
    this.set({ call: this.callSnapshot(session) });
  },

  async startCall(kind = "audio") {
    const conv = this.conversation();
    if (!conv || conv.type !== "dm") return this.toast("Calls work in one-to-one chats");
    if (this.session) return;
    if (!navigator.mediaDevices?.getUserMedia) return this.toast("This browser can't make calls");
    try {
      await e2ee.sendKey(conv); // calls are set up with end-to-end encrypted signalling
      const { call, iceServers } = await api.callAction("start", { conversationId: conv.id, kind });
      const session = new CallSession({ call: { ...call, peer: call.peer || conv.peer }, iceServers, conversation: conv });
      this.attachSession(session);
      startRinging(true);
      this.ringTimeout = setTimeout(() => {
        if (this.session === session && !session.connectedAt && session.call.status === "ringing") session.hangup("missed");
      }, RING_TIMEOUT_MS);
      await session.start();
    } catch (err) {
      stopRinging();
      this.set({ call: null });
      this.session = null;
      this.toast(err.message);
    }
  },

  handleIncomingCall(incoming) {
    const current = this.state.incomingCall;
    if (incoming && !this.session && !this.dismissedCalls.has(incoming.id)) {
      if (current?.id !== incoming.id) {
        this.set({ incomingCall: incoming });
        startRinging(false);
        showNotification(incoming.peer?.displayName || "Bean", `Incoming ${incoming.kind === "video" ? "video" : "voice"} call`);
      }
    } else if (!incoming && current) {
      stopRinging();
      this.set({ incomingCall: null });
    }
  },

  async acceptCall() {
    const incoming = this.state.incomingCall;
    if (!incoming) return;
    stopRinging();
    this.dismissedCalls.add(incoming.id);
    this.set({ incomingCall: null });
    try {
      const conv = this.conversation(incoming.conversationId);
      if (!conv) throw new Error("Call ki chat nahi mili. Bean refresh karein.");
      await e2ee.sendKey(conv);
      const { call, iceServers } = await api.callAction("accept", { id: incoming.id });
      const session = new CallSession({ call: { ...call, peer: call.peer || incoming.peer, status: "connecting" }, iceServers, conversation: conv });
      this.attachSession(session);
      if (this.conversation(incoming.conversationId)) this.selectConversation(incoming.conversationId);
      await session.start();
    } catch (err) {
      this.set({ call: null });
      this.session = null;
      this.toast(err.message);
    }
  },

  async declineCall() {
    const incoming = this.state.incomingCall;
    if (!incoming) return;
    stopRinging();
    this.dismissedCalls.add(incoming.id);
    this.set({ incomingCall: null });
    await api.callAction("decline", { id: incoming.id }).catch(() => {});
    this.syncNow();
  },

  hangup() {
    stopRinging();
    this.session?.hangup("hangup");
  },
  toggleCallMute() {
    this.session?.toggleMute();
  },
  toggleCamera() {
    this.session?.toggleCamera();
  },

  /* ---------------- account ---------------- */

  async logout() {
    this.pendingUnsend?.commit();
    clearTimeout(this.timer);
    this.session?.hangup();
    try {
      await api.logout();
    } catch {}
    await keyStore.clear().catch(() => {}); // the key leaves this device with you
    location.replace("/");
  },

  async logoutAll() {
    try {
      await api.logoutAll();
    } catch (err) {
      return this.toast(err.message);
    }
    await keyStore.clear().catch(() => {});
    location.replace("/");
  },
};
