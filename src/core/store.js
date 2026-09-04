// src/core/store.js
export const INITIAL_STATE = {
  currentUser: {
    id: 'user_1',
    name: 'You',
    avatar: '/avatars/user_1.png'
  },
  activeContactId: 'contact_1',
  contacts: [
    {
      id: 'contact_1',
      name: 'Ayesha Khan',
      status: 'online',
      avatar: '/avatars/ayesha.png',
      lastMessage: 'Hey, let us review the design',
      lastTime: '10:42 AM'
    },
    {
      id: 'contact_2',
      name: 'Zain Ahmed',
      status: 'offline',
      avatar: '/avatars/zain.png',
      lastMessage: 'Check the uploaded PDF',
      lastTime: 'Yesterday'
    }
  ],
  messages: {
    contact_1: [
      {
        id: 'msg_1',
        senderId: 'contact_1',
        text: 'Hey, let us review the design',
        timestamp: '10:42 AM'
      }
    ],
    contact_2: [
      {
        id: 'msg_2',
        senderId: 'user_1',
        text: 'Check the uploaded PDF',
        timestamp: 'Yesterday'
      }
    ]
  }
};

class Store {
  #state;
  #listeners = new Set();

  constructor(initialState = INITIAL_STATE) {
    this.#state = structuredClone(initialState);
  }

  getState() {
    return this.#state;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    this.#listeners.forEach(fn => fn(this.#state));
  }

  // Contract Fix: Accept string ID strictly
  setActiveContact(contactId) {
    if (typeof contactId !== 'string') {
      console.warn('setActiveContact expects string ID, got:', contactId);
      return;
    }
    this.#state.activeContactId = contactId;
    this.#notify();
  }

  sendMessage(contactId, text) {
    if (!text.trim() || !this.#state.messages[contactId]) return;

    const newMessage = {
      id: `msg_${Date.now()}`,
      senderId: this.#state.currentUser.id,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.#state.messages[contactId].push(newMessage);

    // Maintain conversation preview state
    const contact = this.#state.contacts.find(c => c.id === contactId);
    if (contact) {
      contact.lastMessage = text;
      contact.lastTime = newMessage.timestamp;
    }

    this.#notify();
  }
}

export const store = new Store();
