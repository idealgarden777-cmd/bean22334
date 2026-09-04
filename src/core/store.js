// src/core/store.js

// ----- Helper: safe clone (fallback for older browsers) -----
function safeClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

// ----- Helper: generate unique ID -----
function generateId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ----- Initial state with consistent ISO timestamps -----
const now = new Date();
const todayStr = (h, m) => {
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const yesterdayStr = () => {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  d.setHours(14, 0, 0, 0); // arbitrary time
  return d.toISOString();
};

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
      lastTime: todayStr(10, 42)  // ISO string
    },
    {
      id: 'contact_2',
      name: 'Zain Ahmed',
      status: 'offline',
      avatar: '/avatars/zain.png',
      lastMessage: 'Check the uploaded PDF',
      lastTime: yesterdayStr()    // ISO string
    }
  ],
  messages: {
    contact_1: [
      {
        id: 'msg_1',
        senderId: 'contact_1',
        text: 'Hey, let us review the design',
        timestamp: todayStr(10, 42)
      }
    ],
    contact_2: [
      {
        id: 'msg_2',
        senderId: 'user_1',
        text: 'Check the uploaded PDF',
        timestamp: yesterdayStr()
      }
    ]
  }
};

// ----- Store class -----
class Store {
  #state;
  #listeners = new Set();

  constructor(initialState = INITIAL_STATE) {
    this.#state = safeClone(initialState);
  }

  // ---------- Public API ----------
  getState() {
    // Return a deep clone to prevent external mutation
    return safeClone(this.#state);
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // Set active contact – throws if contact does not exist
  setActiveContact(contactId) {
    if (typeof contactId !== 'string') {
      throw new TypeError('setActiveContact expects a string ID');
    }
    const contactExists = this.#state.contacts.some(c => c.id === contactId);
    if (!contactExists) {
      throw new Error(`Contact with id "${contactId}" not found`);
    }
    this.#state.activeContactId = contactId;
    this.#notify();
  }

  // Send a message – throws on invalid contact or empty text
  sendMessage(contactId, text) {
    if (typeof contactId !== 'string') {
      throw new TypeError('sendMessage expects a string contactId');
    }
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new Error('Message text cannot be empty');
    }

    // Verify contact exists
    const contact = this.#state.contacts.find(c => c.id === contactId);
    if (!contact) {
      throw new Error(`Cannot send message: contact "${contactId}" not found`);
    }

    // Ensure messages array exists for this contact
    if (!this.#state.messages[contactId]) {
      this.#state.messages[contactId] = [];
    }

    const newMessage = {
      id: generateId(),
      senderId: this.#state.currentUser.id,
      text: trimmed,
      timestamp: new Date().toISOString()  // consistent ISO format
    };

    this.#state.messages[contactId].push(newMessage);

    // Update conversation preview
    contact.lastMessage = trimmed;
    contact.lastTime = newMessage.timestamp;

    this.#notify();
  }

  // Add a new contact (with optional initial message)
  addContact(contactData, initialMessage = null) {
    // Validate required fields
    if (!contactData.id || !contactData.name) {
      throw new Error('Contact must have at least "id" and "name"');
    }
    // Check for duplicate ID
    if (this.#state.contacts.some(c => c.id === contactData.id)) {
      throw new Error(`Contact with id "${contactData.id}" already exists`);
    }

    const newContact = {
      status: 'offline',
      avatar: '/avatars/default.png',
      lastMessage: '',
      lastTime: null,
      ...contactData
    };

    this.#state.contacts.push(newContact);
    this.#state.messages[contactData.id] = [];

    if (initialMessage) {
      this.sendMessage(contactData.id, initialMessage);
    } else {
      this.#notify();
    }
  }

  // ---------- Private ----------
  #notify() {
    // Pass a clone to prevent listeners from mutating state
    const clone = safeClone(this.#state);
    this.#listeners.forEach(fn => fn(clone));
  }
}

export const store = new Store();
