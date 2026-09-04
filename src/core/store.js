import {
  mockChats,
  mockMessages,
  mockContacts
} from '../data/mock-data.js';

class Store {
  constructor() {
    const chats = Array.isArray(mockChats) ? mockChats : [];

    this.state = {
      chats,
      activeChatId: chats.length > 0 ? chats[0].id : null,
      messages:
        mockMessages && typeof mockMessages === 'object'
          ? mockMessages
          : {},
      contacts: Array.isArray(mockContacts) ? mockContacts : [],
      searchQuery: '',
      isContactPanelOpen: false
    };

    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[Store] Listener error:', error);
      }
    });
  }

  setActiveChat(chatId) {
    if (this.state.activeChatId === chatId) return;

    const chatExists = this.state.chats.some(
      (chat) => chat.id === chatId
    );

    if (!chatExists) return;

    this.state.activeChatId = chatId;
    this.notify();
  }

  sendMessage(chatId, text) {
    if (!chatId || typeof text !== 'string') return;

    const trimmedText = text.trim();

    if (!trimmedText) return;

    const newMessage = {
      id: `msg_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      senderId: 'user_me',
      text: trimmedText,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      status: 'sent'
    };

    if (!Array.isArray(this.state.messages[chatId])) {
      this.state.messages[chatId] = [];
    }

    this.state.messages[chatId].push(newMessage);

    const chat = this.state.chats.find(
      (item) => item.id === chatId
    );

    if (chat) {
      chat.lastMessage = trimmedText;
      chat.lastMessageTime = 'Just now';
    }

    this.notify();
  }

  toggleContactPanel(isOpen) {
    const nextValue =
      typeof isOpen === 'boolean'
        ? isOpen
        : !this.state.isContactPanelOpen;

    if (this.state.isContactPanelOpen === nextValue) return;

    this.state.isContactPanelOpen = nextValue;
    this.notify();
  }

  setSearchQuery(query) {
    const nextQuery =
      typeof query === 'string' ? query : '';

    if (this.state.searchQuery === nextQuery) return;

    this.state.searchQuery = nextQuery;
    this.notify();
  }
}

export const store = new Store();
