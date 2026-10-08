import { api } from "./api.js";
import { loadDemo, saveDemo } from "./demo.js";

const POLL_MS = 3000;

export const store = {
  state: {
    status: "loading", // loading | signedOut | ready | error
    mode: "live", // live | demo
    me: null,
    conversations: [],
    messages: {},
    activeId: null,
    search: "",
    contactPanelOpen: false,
    newChatOpen: false,
    error: null,
  },

  listeners: new Set(),
  pollTimer: null,
  pollTick: 0,

  getState() {
    return this.state;
  },

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  },

  /* ---------- boot ---------- */

  async init() {
    try {
      const res = await api.me();
      if (!res.authenticated) return this.set({ status: "signedOut" });
      this.set({ me: res.user, mode: "live" });
      await this.refreshConversations();
      this.set({ status: "ready" });
      this.startPolling();
    } catch (err) {
      if (err.code === "NO_API") return this.startDemo();
      this.set({ status: "error", error: err.message });
    }
  },

  startDemo() {
    const demo = loadDemo();
    this.set({
      status: "ready",
      mode: "demo",
      me: demo.me,
      conversations: demo.conversations,
      messages: demo.messages,
    });
  },

  persistDemo() {
    if (this.state.mode !== "demo") return;
    const { me, conversations, messages } = this.state;
    saveDemo({ me, conversations, messages });
  },

  /* ---------- selectors ---------- */

  getActiveConversation() {
    return this.state.conversations.find((c) => c.id === this.state.activeId) || null;
  },

  getActiveMessages() {
    return this.state.messages[this.state.activeId] || [];
  },

  getFilteredConversations() {
    const q = this.state.search.trim().toLowerCase();
    if (!q) return this.state.conversations;
    return this.state.conversations.filter(
      (c) =>
        c.contact.displayName.toLowerCase().includes(q) ||
        c.contact.username.toLowerCase().includes(q)
    );
  },

  /* ---------- actions ---------- */

  setSearch(search) {
    this.set({ search });
  },

  toggleContactPanel(open = !this.state.contactPanelOpen) {
    this.set({ contactPanelOpen: open });
  },

  toggleNewChat(open = !this.state.newChatOpen) {
    this.set({ newChatOpen: open });
  },

  closeChat() {
    this.set({ activeId: null, contactPanelOpen: false });
  },

  async selectConversation(id) {
    this.set({ activeId: id });
    if (this.state.mode === "live" && !this.state.messages[id]) {
      await this.fetchMessages(id);
    }
  },

  async refreshConversations() {
    if (this.state.mode !== "live") return;
    const { conversations } = await api.conversations();
    this.set({ conversations });
  },

  async fetchMessages(id, { incremental = false } = {}) {
    const existing = this.state.messages[id] || [];
    const confirmed = existing.filter((m) => !m.pending && !m.failed);
    const after = incremental && confirmed.length ? confirmed[confirmed.length - 1].createdAt : null;

    const { messages } = await api.messages(id, after);
    if (incremental && !messages.length) return;

    const known = new Set(existing.map((m) => m.id));
    const merged = incremental ? [...existing, ...messages.filter((m) => !known.has(m.id))] : messages;
    this.set({ messages: { ...this.state.messages, [id]: merged } });
  },

  async startConversation(username) {
    if (this.state.mode === "demo") {
      const clean = username.replace(/@bean$/, "").toLowerCase();
      let conv = this.state.conversations.find((c) => c.contact.username === clean);
      if (!conv) {
        conv = {
          id: `c_${Date.now()}`,
          updatedAt: new Date().toISOString(),
          lastMessage: "",
          lastSenderId: null,
          contact: { id: `u_${clean}`, username: clean, displayName: clean, beanId: `${clean}@bean` },
        };
        this.set({
          conversations: [conv, ...this.state.conversations],
          messages: { ...this.state.messages, [conv.id]: [] },
        });
        this.persistDemo();
      }
      this.set({ activeId: conv.id, newChatOpen: false });
      return conv;
    }

    const { conversation } = await api.openConversation(username);
    const others = this.state.conversations.filter((c) => c.id !== conversation.id);
    this.set({ conversations: [conversation, ...others], newChatOpen: false });
    await this.selectConversation(conversation.id);
    return conversation;
  },

  async searchUsers(q) {
    if (this.state.mode === "demo") return [];
    const { users } = await api.searchUsers(q);
    return users;
  },

  async sendMessage(text) {
    const clean = text.trim();
    const id = this.state.activeId;
    if (!clean || !id) return;

    const temp = {
      id: `tmp_${Date.now()}`,
      senderId: this.state.me.id,
      text: clean,
      createdAt: new Date().toISOString(),
      pending: this.state.mode === "live",
    };

    this.appendMessage(id, temp);

    if (this.state.mode === "demo") {
      this.persistDemo();
      return;
    }

    try {
      const { message } = await api.sendMessage(id, clean);
      this.replaceMessage(id, temp.id, message);
    } catch {
      this.replaceMessage(id, temp.id, { ...temp, pending: false, failed: true });
    }
  },

  retryMessage(messageId) {
    const id = this.state.activeId;
    const msg = (this.state.messages[id] || []).find((m) => m.id === messageId);
    if (!msg) return;
    this.set({
      messages: { ...this.state.messages, [id]: this.state.messages[id].filter((m) => m.id !== messageId) },
    });
    this.sendMessage(msg.text);
  },

  appendMessage(convId, message) {
    const list = [...(this.state.messages[convId] || []), message];
    const conversations = this.state.conversations
      .map((c) =>
        c.id === convId
          ? { ...c, lastMessage: message.text, lastSenderId: message.senderId, updatedAt: message.createdAt }
          : c
      )
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    this.set({ messages: { ...this.state.messages, [convId]: list }, conversations });
  },

  replaceMessage(convId, tempId, message) {
    const list = (this.state.messages[convId] || []).map((m) => (m.id === tempId ? message : m));
    this.set({ messages: { ...this.state.messages, [convId]: list } });
  },

  async logout() {
    if (this.state.mode === "live") {
      try {
        await api.logout();
      } catch {}
    }
    this.stopPolling();
    this.set({ status: "signedOut", me: null, conversations: [], messages: {}, activeId: null });
  },

  /* ---------- polling (near real-time) ---------- */

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      if (document.hidden || this.state.mode !== "live") return;
      this.pollTick += 1;
      try {
        if (this.state.activeId) await this.fetchMessages(this.state.activeId, { incremental: true });
        if (this.pollTick % 3 === 0) await this.refreshConversations();
      } catch (err) {
        if (err.status === 401) this.set({ status: "signedOut" });
      }
    }, POLL_MS);
  },

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  },
};
