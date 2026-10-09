/* In-browser demo backend for local dev (no /api). Mirrors the real API shapes.
 * Data lives in localStorage; uploads use object URLs for this session only. */
const KEY = "bean_demo_v2";
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

const ME = { id: "me", username: "you", displayName: "You", beanId: "you@bean" };
const PEOPLE = [
  { id: "u1", username: "ayesha", displayName: "Ayesha Khan", beanId: "ayesha@bean" },
  { id: "u2", username: "zain", displayName: "Zain Ahmed", beanId: "zain@bean" },
  { id: "u3", username: "sara", displayName: "Sara Malik", beanId: "sara@bean" },
  { id: "u4", username: "leo11", displayName: "Leo", beanId: "leo11@bean" },
  { id: "neyo", username: "neyo", displayName: "Neyo", beanId: "neyo@bean", avatarUrl: "/neyo-icon.png", isBot: true },
];

function seed() {
  return {
    convs: [
      { id: "c1", type: "dm", title: null, memberIds: ["me", "u1"], admins: ["me", "u1"], muted: false, readAt: { me: ago(1), u1: ago(1) }, updatedAt: ago(3) },
      { id: "c2", type: "dm", title: null, memberIds: ["me", "u2"], admins: ["me", "u2"], muted: false, readAt: { me: ago(200), u2: ago(1) }, updatedAt: ago(140) },
      { id: "c3", type: "group", title: "Signaturesi Team", memberIds: ["me", "u1", "u2", "u3"], admins: ["me"], muted: false, readAt: { me: ago(30), u1: ago(5), u2: ago(5), u3: ago(5) }, updatedAt: ago(20) },
    ],
    messages: [
      { id: "m1", conversationId: "c1", senderId: "u1", kind: "text", text: "Hi! Bean ka naya design dekha?", createdAt: ago(6) },
      { id: "m2", conversationId: "c1", senderId: "me", kind: "text", text: "Haan, bilkul Neyo jaisa clean 🔥", createdAt: ago(3), reactions: [{ emoji: "❤️", userIds: ["u1"] }] },
      { id: "m3", conversationId: "c2", senderId: "u2", kind: "text", text: "Hey, are we still meeting?", createdAt: ago(140) },
      { id: "m4", conversationId: "c3", senderId: null, kind: "system", text: 'You created "Signaturesi Team"', createdAt: ago(60) },
      { id: "m5", conversationId: "c3", senderId: "u3", kind: "text", text: "Welcome everyone 👋", createdAt: ago(25) },
      { id: "m6", conversationId: "c3", senderId: "u2", kind: "call", text: "Missed voice call", createdAt: ago(21) },
      { id: "m7", conversationId: "c3", senderId: "u1", kind: "text", text: "Launch Friday ko hai", createdAt: ago(20) },
    ].map((m) => ({ reactions: [], replyTo: null, attachment: null, editedAt: null, deletedAt: null, updatedAt: m.createdAt, ...m })),
  };
}

let db = load();
if (db.me) Object.assign(ME, db.me);
const saveMe = () => {
  db.me = { username: ME.username, beanId: ME.beanId, displayName: ME.displayName };
  save();
};
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.convs) return saved;
  } catch {}
  return seed();
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {}
}

const alive = (m) => !m.expiresAt || m.expiresAt > new Date().toISOString();
const userById = (id) => {
  const u = id === "me" ? ME : PEOPLE.find((p) => p.id === id);
  const on = id === "u1" || id === "neyo";
  return u ? { ...u, online: on, lastSeenAt: on ? new Date().toISOString() : ago(42) } : null;
};

function preview(m) {
  if (!m) return "";
  if (m.deletedAt) return "Message deleted";
  if (m.kind === "image") return "📷 Photo";
  if (m.kind === "audio") return "🎤 Voice message";
  if (m.kind === "file") return `📎 ${m.attachment?.name || "File"}`;
  return m.text;
}

function shapeConv(c) {
  const msgs = db.messages.filter((m) => m.conversationId === c.id && alive(m));
  const last = msgs[msgs.length - 1];
  const members = c.memberIds.map((id) => ({ ...userById(id), role: c.admins.includes(id) ? "admin" : "member", lastReadAt: c.readAt[id] }));
  const peer = c.type === "dm" ? members.find((m) => m.id !== "me") : null;
  return {
    id: c.id,
    type: c.type,
    title: c.type === "group" ? c.title : peer.displayName,
    members,
    peer,
    myRole: c.admins.includes("me") ? "admin" : "member",
    muted: c.muted,
    unread: msgs.filter((m) => m.senderId && m.senderId !== "me" && m.kind !== "system" && m.createdAt > (c.readAt.me || "")).length,
    lastMessage: preview(last),
    lastSenderId: last?.senderId || null,
    updatedAt: last?.createdAt || c.updatedAt,
  };
}

function shapeMsg(m) {
  const reply = m.replyTo ? db.messages.find((x) => x.id === m.replyTo) : null;
  return {
    ...m,
    text: m.deletedAt ? "" : m.text,
    attachment: m.deletedAt ? null : m.attachment,
    replyTo: reply ? { id: reply.id, senderId: reply.senderId, kind: reply.kind, text: preview(reply) } : null,
  };
}

const list = () => db.convs.map(shapeConv).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
const conv = (id) => {
  const c = db.convs.find((x) => x.id === id);
  if (!c) throw Object.assign(new Error("Chat not found"), { status: 404 });
  return c;
};
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));

function addMessage(m) {
  const now = new Date().toISOString();
  const msg = { id: uid(), reactions: [], replyTo: null, attachment: null, editedAt: null, deletedAt: null, createdAt: now, updatedAt: now, ...m };
  db.messages.push(msg);
  save();
  return msg;
}

let pendingReplyTimer = null;
function fakeReply(conversationId) {
  const c = db.convs.find((x) => x.id === conversationId);
  if (!c || c.type !== "dm") return;
  const other = c.memberIds.find((id) => id !== "me");
  clearTimeout(pendingReplyTimer);
  typingUntil = { conversationId, userId: other, until: Date.now() + 2500 };
  pendingReplyTimer = setTimeout(() => {
    const replies = ["Acha 👍", "Haan bilkul", "Theek hai, baad mein baat karte hain", "😂", "Nice!"];
    addMessage({ conversationId, senderId: other, kind: "text", text: replies[Math.floor(Math.random() * replies.length)] });
    c.readAt[other] = new Date().toISOString();
    save();
  }, 2600);
}
let typingUntil = null;

const SKEY = "bean_demo_session";
const settings = () => ({ messageTimer: 0, wallpaper: "none", ...(db.settings || {}) });
const signedIn = () => localStorage.getItem(SKEY) === "1";

export const demoApi = {
  sessions: () => delay({ sessions: [{ id: "s1", device: "This browser", createdAt: new Date().toISOString(), current: true }] }),
  revokeSession: () => delay({ sessions: [] }),
  logoutAll: () => {
    localStorage.removeItem(SKEY);
    return delay({ success: true });
  },
  me: () => delay(signedIn() ? { authenticated: true, user: { ...ME, online: true }, settings: settings() } : { authenticated: false }),
  logout: () => {
    localStorage.removeItem(SKEY);
    return delay({ success: true });
  },
  login: (username, password) => {
    if (!username || !password) return Promise.reject(new Error("Invalid Bean ID or password"));
    ME.username = String(username).toLowerCase().replace(/@bean$/, "");
    ME.beanId = `${ME.username}@bean`;
    if (ME.displayName === "You") ME.displayName = ME.username;
    saveMe();
    localStorage.setItem(SKEY, "1");
    return delay({ success: true, user: ME });
  },
  register: (username, password) => demoApi.login(username, password),
  checkUsername: (username) => delay({ available: !PEOPLE.some((p) => p.username === String(username).toLowerCase()) }),
  updateMe: (changes) => {
    if (changes.displayName) ME.displayName = changes.displayName.trim();
    saveMe();
    db.settings = { ...settings(), ...(changes.messageTimer !== undefined ? { messageTimer: Number(changes.messageTimer) } : {}), ...(changes.wallpaper ? { wallpaper: changes.wallpaper } : {}), ...(changes.ghostEnabled !== undefined ? { ghostEnabled: Boolean(changes.ghostEnabled), ghostUntil: changes.ghostEnabled && changes.ghostHours ? new Date(Date.now() + changes.ghostHours * 3600000).toISOString() : null } : {}), ...(changes.ghostNote !== undefined ? { ghostNote: changes.ghostNote } : {}) };
    save();
    return delay({ success: true, user: { ...ME, online: true }, settings: settings() });
  },
  searchUsers: (q) => {
    const s = q.toLowerCase().replace(/@bean$/, "");
    return delay({ users: PEOPLE.filter((p) => p.username.startsWith(s) || p.displayName.toLowerCase().includes(s)).map((p) => userById(p.id)) });
  },
  conversations: () => delay({ conversations: list() }),

  async conversationAction(action, p) {
    if (action === "open_dm") {
      const name = String(p.username).toLowerCase().replace(/@bean$/, "");
      const person = PEOPLE.find((x) => x.username === name);
      if (!person) throw Object.assign(new Error(`No Bean ID called ${name}@bean`), { status: 404 });
      let c = db.convs.find((x) => x.type === "dm" && x.memberIds.includes(person.id));
      if (!c) {
        c = { id: uid(), type: "dm", title: null, memberIds: ["me", person.id], admins: ["me", person.id], muted: false, readAt: { me: new Date().toISOString() }, updatedAt: new Date().toISOString() };
        db.convs.push(c);
        save();
      }
      return delay({ conversation: shapeConv(c) });
    }
    if (action === "create_group") {
      const ids = PEOPLE.filter((x) => p.usernames.map((u) => u.replace(/@bean$/, "")).includes(x.username)).map((x) => x.id);
      if (!p.title?.trim()) throw new Error("Give the group a name");
      if (!ids.length) throw new Error("Add at least one Bean ID");
      const now = new Date().toISOString();
      const c = { id: uid(), type: "group", title: p.title.trim(), memberIds: ["me", ...ids], admins: ["me"], muted: false, readAt: { me: now }, updatedAt: now };
      db.convs.push(c);
      addMessage({ conversationId: c.id, senderId: null, kind: "system", text: `You created "${c.title}"` });
      return delay({ conversation: shapeConv(c) });
    }
    const c = conv(p.conversationId);
    if (action === "rename") {
      c.title = p.title.trim();
      addMessage({ conversationId: c.id, senderId: null, kind: "system", text: `You renamed the group to "${c.title}"` });
    } else if (action === "add_members") {
      const ids = PEOPLE.filter((x) => p.usernames.map((u) => u.replace(/@bean$/, "")).includes(x.username)).map((x) => x.id);
      ids.forEach((id) => !c.memberIds.includes(id) && c.memberIds.push(id));
      addMessage({ conversationId: c.id, senderId: null, kind: "system", text: `You added ${ids.map((id) => userById(id).displayName).join(", ")}` });
    } else if (action === "remove_member") {
      c.memberIds = c.memberIds.filter((id) => id !== p.userId);
      addMessage({ conversationId: c.id, senderId: null, kind: "system", text: `You removed ${userById(p.userId)?.displayName}` });
    } else if (action === "leave") {
      db.convs = db.convs.filter((x) => x.id !== c.id);
    } else if (action === "mute") {
      c.muted = Boolean(p.muted);
    } else if (action === "read") {
      c.readAt.me = new Date().toISOString();
    }
    save();
    return delay({ success: true, conversation: db.convs.includes(c) ? shapeConv(c) : null });
  },

  async messages(conversationId) {
    conv(conversationId);
    return delay({ messages: db.messages.filter((m) => m.conversationId === conversationId && alive(m)).map(shapeMsg), hasMore: false });
  },

  neyoReply: () => delay({ ok: true }),
  neyoGhost: () => delay({ skipped: "demo" }),
  neyoTick: () => delay({ skipped: "demo" }),

  async messageAction(action, p) {
    const now = new Date().toISOString();
    if (action === "send") {
      const c = conv(p.conversationId);
      const a = p.attachment;
      const kind = a ? (a.mime.startsWith("image/") ? "image" : a.mime.startsWith("audio/") ? "audio" : "file") : "text";
      const msg = addMessage({
        conversationId: c.id,
        senderId: "me",
        kind,
        text: p.text || "",
        attachment: a ? { url: a.path, name: a.name, size: a.size, mime: a.mime, duration: a.duration || null } : null,
        replyTo: p.replyTo || null,
        expiresAt: settings().messageTimer ? new Date(Date.now() + settings().messageTimer * 1000).toISOString() : null,
      });
      c.readAt.me = now;
      save();
      fakeReply(c.id);
      return delay({ message: shapeMsg(msg), clientId: p.clientId });
    }
    const msg = db.messages.find((m) => m.id === p.messageId);
    if (!msg) throw new Error("Message not found");
    if (action === "edit") Object.assign(msg, { text: p.text.trim(), editedAt: now, updatedAt: now });
    if (action === "delete") Object.assign(msg, { text: "", attachment: null, reactions: [], deletedAt: now, updatedAt: now });
    if (action === "react") {
      const mine = msg.reactions.find((r) => r.userIds.includes("me"));
      msg.reactions = msg.reactions.map((r) => ({ ...r, userIds: r.userIds.filter((u) => u !== "me") })).filter((r) => r.userIds.length);
      if (mine?.emoji !== p.emoji) {
        const r = msg.reactions.find((x) => x.emoji === p.emoji);
        if (r) r.userIds.push("me");
        else msg.reactions.push({ emoji: p.emoji, userIds: ["me"] });
      }
      msg.updatedAt = now;
    }
    save();
    return delay({ message: shapeMsg(msg) });
  },

  async sync({ active, since, read, lists }) {
    const out = { now: new Date().toISOString(), incomingCall: null };
    if (active) {
      const c = db.convs.find((x) => x.id === active);
      if (c) {
        if (read === "1" || read === 1) {
          c.readAt.me = out.now;
          save();
        }
        out.active = {
          conversationId: active,
          messages: db.messages.filter((m) => m.conversationId === active && alive(m) && (!since || m.updatedAt >= since)).map(shapeMsg),
          typing: typingUntil && typingUntil.conversationId === active && typingUntil.until > Date.now() ? [typingUntil.userId] : [],
          reads: { ...c.readAt },
        };
      }
    }
    if (lists === "1" || lists === 1) out.conversations = list();
    return out;
  },
  typing: () => Promise.resolve({ ok: true }),

  async upload(conversationId, file, onProgress) {
    onProgress?.(1);
    return { path: URL.createObjectURL(file), name: file.name, size: file.size, mime: file.type || "application/octet-stream" };
  },

  callConfig: () => Promise.resolve({ iceServers: [] }),
  callPoll: () => Promise.reject(new Error("Calls need the live server")),
  callAction: () => Promise.reject(new Error("Calls need the live server (deploy to Vercel)")),
};
