import { mockChats, mockMessages, mockContacts } from '../data/mock-data.js';

class Store {
  constructor() {
    this.state = {
      chats: mockChats || [],
      activeChatId: mockChats && mockChats.length > 0 ? mockChats[0].id : null,
      messages: mockMessages || {},
      contacts: mockContacts || [],
      searchQuery: '',
      isContactPanelOpen: false
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  setActiveChat(chatId) {
    this.state.activeChatId = chatId;
    this.notify();
  }

  sendMessage(chatId, text) {
    if (!text || !text.trim()) return;

    const newMessage = {
      id: `msg_${Date.now()}`,
      senderId: 'user_me',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    if (!this.state.messages[chatId]) {
      this.state.messages[chatId] = [];
    }

    this.state.messages[chatId].push(newMessage);

    const chat = this.state.chats.find((c) => c.id === chatId);
    if (chat) {
      chat.lastMessage = text.trim();
      chat.lastMessageTime = 'Just now';
    }

    this.notify();
  }

  toggleContactPanel(isOpen) {
    this.state.isContactPanelOpen =
      typeof isOpen === 'boolean' ? isOpen : !this.state.isContactPanelOpen;
    this.notify();
  }

  setSearchQuery(query) {
    this.state.searchQuery = query;
    this.notify();
  }
}

export const store = new Store();
