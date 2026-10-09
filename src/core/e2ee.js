/* =========================================================
 * Bean E2EE manager: Chat Lock, contact keys, chat keys,
 * encrypt / decrypt of messages, reactions, media and call signals.
 * The server only sees ciphertext and public keys.
 * ========================================================= */
import * as C from "./crypto.js";
import { api } from "./api.js";
import { keyStore } from "./keystore.js";

export class E2EEError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

const USER_KEY_TTL = 30000;
const msgAad = (cid, senderId, epoch) => `bean-msg-v1|${cid}|${senderId}|${epoch}`;
const reactAad = (cid, userId, messageId, epoch) => `bean-react-v1|${cid}|${userId}|${messageId}|${epoch}`;
const callAad = (cid, callId, type, epoch) => `bean-call-v1|${cid}|${callId}|${type}|${epoch}`;

export const e2ee = {
  me: null,
  priv: null,
  pub: null,
  fp: null,
  record: null,
  users: new Map(), // userId -> { pub, fp, at }
  pins: {}, // userId -> { fp, verified, tofu, history: [] }
  changed: new Set(), // userIds whose key changed and the change is not accepted yet
  chatKeys: new Map(), // `${cid}|${epoch}` -> { key, strict }
  latest: new Map(), // cid -> { epoch, recipients: Map(userId -> fp), at }
  loading: new Map(), // cid -> Promise
  listeners: new Set(),

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  emit() {
    this.listeners.forEach((fn) => fn());
  },

  /* ---------------- Chat Lock ---------------- */

  async status(me) {
    this.me = me;
    this.loadPins();
    const { key } = await api.keysMe();
    this.record = key;
    if (!key) return "setup";
    const local = await keyStore.get(me.id);
    const serverFp = await C.fingerprint(key.publicKey);
    if (serverFp !== key.fingerprint) throw new E2EEError("BAD_SERVER_KEY", "Server ne galat key di. Bean support se rabta karein.");
    if (local && local.fp === serverFp && local.priv) {
      this.useIdentity(local.priv, key.publicKey, serverFp);
      return "ready";
    }
    if (local) await keyStore.del(me.id); // key was reset on another device
    return "unlock";
  },

  useIdentity(priv, pub, fp) {
    this.priv = priv;
    this.pub = pub;
    this.fp = fp;
    this.users.set(this.me.id, { pub, fp, at: Date.now() });
  },

  async saveDevice(pkcs8, pub, fp) {
    const priv = await C.importPrivate(pkcs8);
    await keyStore.set(this.me.id, { priv, fp, pub });
    this.useIdentity(priv, pub, fp);
  },

  async setup(passphrase, { reset = false } = {}) {
    const id = await C.generateIdentity();
    const backup = await C.sealBackup(id.pkcs8, passphrase);
    await api.keysPublish({ publicKey: id.pub, fingerprint: id.fingerprint, backup, reset });
    await this.saveDevice(id.pkcs8, id.pub, id.fingerprint);
    this.record = { publicKey: id.pub, fingerprint: id.fingerprint, backup };
    this.chatKeys.clear();
    this.latest.clear();
    id.pkcs8.fill(0);
  },

  async unlock(passphrase) {
    if (!this.record) throw new E2EEError("NO_KEY", "Chat Lock not set up");
    const pkcs8 = await C.openBackup(this.record.backup, passphrase);
    const pub = await C.publicOf(pkcs8);
    if (pub.x !== this.record.publicKey.x || pub.y !== this.record.publicKey.y) {
      throw new E2EEError("MISMATCH", "Backup aur public key match nahi karte");
    }
    await this.saveDevice(pkcs8, pub, await C.fingerprint(pub));
    pkcs8.fill(0);
  },

  async changeLock(oldPass, newPass) {
    const { key } = await api.keysMe();
    const pkcs8 = await C.openBackup(key.backup, oldPass);
    const backup = await C.sealBackup(pkcs8, newPass);
    pkcs8.fill(0);
    await api.keysBackup({ backup, fingerprint: key.fingerprint });
    this.record = { ...key, backup };
  },

  /* forget the key on this device (Chat Lock needed next time) */
  async lockDevice() {
    if (this.me) await keyStore.del(this.me.id);
    this.priv = null;
    this.chatKeys.clear();
  },

  /* ---------------- contacts' keys + safety numbers ---------------- */

  loadPins() {
    try {
      this.pins = JSON.parse(localStorage.getItem(`bean_pins_v1_${this.me.id}`)) || {};
    } catch {
      this.pins = {};
    }
  },
  savePins() {
    try {
      localStorage.setItem(`bean_pins_v1_${this.me.id}`, JSON.stringify(this.pins));
    } catch {}
  },

  async keysFor(ids, { maxAge = USER_KEY_TTL } = {}) {
    const now = Date.now();
    const need = [...new Set(ids)].filter((id) => id && (!this.users.has(id) || now - this.users.get(id).at > maxAge));
    if (need.length) {
      const { keys } = await api.keys(need);
      const found = new Set();
      for (const k of keys || []) {
        const fp = await C.fingerprint(k.publicKey); // never trust the server's fingerprint
        if (fp !== k.fingerprint) continue;
        found.add(k.userId);
        this.users.set(k.userId, { pub: k.publicKey, fp, at: now });
        if (k.userId === this.me.id) continue;
        const pin = this.pins[k.userId];
        if (!pin) this.pins[k.userId] = { fp, verified: false, tofu: true, history: [] };
        else if (pin.fp !== fp) this.changed.add(k.userId);
        else this.changed.delete(k.userId);
      }
      for (const id of need) if (!found.has(id)) this.users.delete(id);
      this.savePins();
      this.emit();
    }
    return ids.map((id) => this.users.get(id) || null);
  },

  keyChanged(userId) {
    return this.changed.has(userId);
  },
  isVerified(userId) {
    return Boolean(this.pins[userId]?.verified) && !this.changed.has(userId);
  },
  acceptKey(userId) {
    const now = this.users.get(userId);
    const old = this.pins[userId];
    if (!now) return;
    this.pins[userId] = { fp: now.fp, verified: false, tofu: false, history: [...new Set([...(old?.history || []), ...(old ? [old.fp] : [])])] };
    this.changed.delete(userId);
    this.savePins();
    this.emit();
  },
  setVerified(userId, verified = true) {
    const pin = this.pins[userId];
    if (!pin || this.changed.has(userId)) return;
    pin.verified = verified;
    pin.tofu = false;
    this.savePins();
    this.emit();
  },
  async safetyNumber(userId) {
    const [them] = await this.keysFor([userId], { maxAge: 5000 });
    if (!them || !this.fp) return null;
    return C.safetyNumber(this.fp, them.fp);
  },

  async trust(senderId, senderPub) {
    const fp = await C.fingerprint(senderPub);
    if (senderId === this.me.id) return { ok: fp === this.fp, strict: fp === this.fp };
    if (!this.pins[senderId]) await this.keysFor([senderId], { maxAge: 0 }).catch(() => {});
    const pin = this.pins[senderId];
    if (!pin) return { ok: true, strict: false }; // first contact on this device (trust on first use)
    if (pin.fp === fp && !this.changed.has(senderId)) return { ok: true, strict: true };
    if (pin.fp === fp || pin.history.includes(fp)) return { ok: true, strict: false }; // older key: read only
    // unknown key: readable only while this device has never verified / accepted this contact
    return { ok: Boolean(pin.tofu && !pin.verified), strict: false };
  },

  /* ---------------- chat keys ---------------- */

  async addWraps(wraps) {
    for (const w of wraps || []) {
      const id = `${w.conversationId}|${w.epoch}`;
      if (this.chatKeys.has(id) && this.chatKeys.get(id).strict) continue;
      try {
        const t = await this.trust(w.senderId, w.senderPub);
        if (!t.ok) continue;
        const info = C.wrapInfo(w.conversationId, w.epoch, w.senderId, this.me.id);
        const key = await C.unwrapChatKey(w.wrapped, this.priv, w.senderPub, info);
        this.chatKeys.set(id, { key, strict: t.strict });
      } catch {
        /* wrapped for an older key of mine (Chat Lock was reset) */
      }
    }
  },

  async loadAllWraps() {
    const { wraps } = await api.keyWraps();
    await this.addWraps(wraps);
  },

  loadConv(cid, { force = false } = {}) {
    const L = this.latest.get(cid);
    if (!force && L && Date.now() - L.at < 3000) return Promise.resolve(L);
    if (this.loading.has(cid)) return this.loading.get(cid);
    const p = (async () => {
      try {
        const { wraps, latest } = await api.convKeys(cid);
        await this.addWraps(wraps);
        const entry = { epoch: latest.epoch || 0, recipients: new Map((latest.recipients || []).map((r) => [r.userId, r.fp])), at: Date.now() };
        this.latest.set(cid, entry);
        return entry;
      } finally {
        this.loading.delete(cid);
      }
    })();
    this.loading.set(cid, p);
    return p;
  },

  async keyFor(cid, epoch) {
    const id = `${cid}|${epoch}`;
    let entry = this.chatKeys.get(id);
    if (!entry) {
      this.missing ||= new Map();
      const triedAt = this.missing.get(id) || 0;
      if (Date.now() - triedAt > 8000) {
        this.missing.set(id, Date.now());
        await this.loadConv(cid, { force: true }).catch(() => {});
      } else if (this.loading.has(cid)) {
        await this.loading.get(cid).catch(() => {});
      }
      entry = this.chatKeys.get(id);
      if (entry) this.missing.delete(id);
    }
    if (!entry) throw new E2EEError("NO_CHAT_KEY", "Is device ke paas is message ki key nahi");
    return entry.key;
  },

  /* The key to SEND with: a fresh epoch whenever members or their keys changed. */
  async sendKey(conv) {
    if (!this.priv) throw new E2EEError("LOCKED", "Chat Lock khulna baqi hai");
    const ids = conv.members.map((m) => m.id);
    if (conv.members.some((m) => m.isBot)) throw new E2EEError("BOT", "Neyo chat is not end-to-end encrypted");
    await this.keysFor(ids);
    const missing = conv.members.filter((m) => !this.users.get(m.id));
    if (missing.length) {
      throw new E2EEError("NO_KEY", `${missing.map((m) => m.displayName).join(", ")} ne abhi Bean v2 khol kar Chat Lock set nahi kiya. Unke aane ke baad message ja sakega.`, { users: missing });
    }
    const changed = ids.filter((id) => id !== this.me.id && this.changed.has(id));
    if (changed.length) {
      const names = conv.members.filter((m) => changed.includes(m.id)).map((m) => m.displayName).join(", ");
      throw new E2EEError("KEY_CHANGED", `${names} ki security key badal gayi. Chat mein "Theek hai" dabayein, phir bhejein.`, { users: changed });
    }

    const good = (L) => {
      if (!L?.epoch) return null;
      const entry = this.chatKeys.get(`${conv.id}|${L.epoch}`);
      if (!entry?.strict) return null;
      if (L.recipients.size !== ids.length) return null;
      for (const id of ids) if (L.recipients.get(id) !== this.users.get(id).fp) return null;
      return { epoch: L.epoch, key: entry.key };
    };

    let L = await this.loadConv(conv.id, { force: !this.latest.has(conv.id) || Date.now() - this.latest.get(conv.id).at > 30000 });
    const ready = good(L);
    if (ready) return ready;

    for (let attempt = 0; attempt < 3; attempt++) {
      const epoch = (L.epoch || 0) + 1;
      const raw = C.newChatKeyRaw();
      const wraps = [];
      for (const id of ids) {
        const u = this.users.get(id);
        wraps.push({ userId: id, recipientFp: u.fp, wrapped: await C.wrapChatKey(raw, this.priv, u.pub, C.wrapInfo(conv.id, epoch, this.me.id, id)) });
      }
      try {
        await api.rekey({ conversationId: conv.id, epoch, senderPub: this.pub, wraps });
        const key = await C.importChatKey(raw);
        raw.fill(0);
        this.chatKeys.set(`${conv.id}|${epoch}`, { key, strict: true });
        this.latest.set(conv.id, { epoch, recipients: new Map(wraps.map((w) => [w.userId, w.recipientFp])), at: Date.now() });
        return { epoch, key };
      } catch (err) {
        raw.fill(0);
        if (err.status !== 409) throw err;
        this.users.clear(); // a member may have a new key
        await this.keysFor(ids, { maxAge: 0 });
        L = await this.loadConv(conv.id, { force: true });
        const now = good(L);
        if (now) return now;
      }
    }
    throw new E2EEError("REKEY_FAILED", "Chat key update nahi ho saka. Dobara koshish karein.");
  },

  /* ---------------- messages ---------------- */

  async encryptMessage(conv, payload) {
    const { epoch, key } = await this.sendKey(conv);
    const box = await C.encryptJson(key, payload, msgAad(conv.id, this.me.id, epoch));
    return { v: 1, e: epoch, ...box };
  },

  async decryptPayload(cid, senderId, enc) {
    const key = await this.keyFor(cid, enc.e);
    return C.decryptJson(key, enc, msgAad(cid, senderId, enc.e));
  },

  /* server message -> readable message (never throws) */
  async openMessage(m) {
    if (!m) return m;
    let out = { ...m };
    if (m.enc) {
      try {
        const p = await this.decryptPayload(m.conversationId, m.senderId, m.enc);
        out.kind = ["text", "image", "audio", "file"].includes(p.t) ? p.t : "text";
        out.text = String(p.x || "").slice(0, 4000);
        out.attachment = m.attachment && p.a
          ? { url: null, encUrl: m.attachment.url, name: p.a.name, size: p.a.size, mime: p.a.mime, duration: p.a.duration || null, k: p.a.k, iv: p.a.iv }
          : null;
      } catch (err) {
        out.kind = "text";
        out.text = "";
        out.attachment = null;
        out.decryptError = err.code === "NO_CHAT_KEY" ? "nokey" : "failed";
      }
    }
    if (m.replyTo?.enc) {
      try {
        const p = await this.decryptPayload(m.conversationId, m.replyTo.senderId, m.replyTo.enc);
        const kind = p.t || "text";
        out.replyTo = { ...m.replyTo, kind, text: kind === "image" ? "📷 Photo" : kind === "audio" ? "🎤 Voice message" : kind === "file" ? `📎 ${p.a?.name || "File"}` : String(p.x || "").slice(0, 140) };
      } catch {
        out.replyTo = { ...m.replyTo, text: "🔒 Encrypted message" };
      }
    }
    if (m.encReactions?.length) {
      const grouped = new Map((m.reactions || []).map((r) => [r.emoji, [...r.userIds]]));
      for (const r of m.encReactions) {
        try {
          const key = await this.keyFor(m.conversationId, r.enc.e);
          const p = await C.decryptJson(key, r.enc, reactAad(m.conversationId, r.userId, m.id, r.enc.e));
          const emoji = String(p.r || "").slice(0, 16);
          if (!emoji) continue;
          grouped.set(emoji, [...(grouped.get(emoji) || []), r.userId]);
        } catch {}
      }
      out.reactions = [...grouped.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));
    }
    return out;
  },

  async previewOf(conv) {
    const last = conv.lastEnc;
    if (!last) return conv.lastMessage;
    try {
      const p = await this.decryptPayload(conv.id, last.senderId, last.enc);
      if (p.t === "image") return "📷 Photo";
      if (p.t === "audio") return "🎤 Voice message";
      if (p.t === "file") return `📎 ${p.a?.name || "File"}`;
      return String(p.x || "").slice(0, 140);
    } catch {
      return "🔒 Encrypted message";
    }
  },

  async encryptReaction(conv, messageId, emoji) {
    const { epoch, key } = await this.sendKey(conv);
    const box = await C.encryptJson(key, { r: emoji }, reactAad(conv.id, this.me.id, messageId, epoch));
    return { v: 1, e: epoch, ...box };
  },

  /* ---------------- media ---------------- */

  async encryptFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { ct, k, iv } = await C.encryptFile(bytes);
    return { blob: new Blob([ct], { type: "application/octet-stream" }), k, iv };
  },

  async decryptMedia(att) {
    const res = await fetch(att.encUrl);
    if (!res.ok) throw new Error("Download failed");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const plain = await C.decryptFile(bytes, att.k, att.iv);
    return URL.createObjectURL(new Blob([plain], { type: att.mime || "application/octet-stream" }));
  },

  /* ---------------- calls ---------------- */

  async encryptSignal(conv, callId, type, obj) {
    const { epoch, key } = await this.sendKey(conv);
    const box = await C.encryptJson(key, obj, callAad(conv.id, callId, type, epoch));
    return { v: 1, e: epoch, ...box };
  },
  async decryptSignal(cid, callId, type, enc) {
    const key = await this.keyFor(cid, enc.e);
    return C.decryptJson(key, enc, callAad(cid, callId, type, enc.e));
  },
};
