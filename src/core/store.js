// src/core/store.js

const INITIAL_STATE = {
  currentUser: {
    id: 'user_1',
    name: 'You',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You'
  },
  activeContactId: 'contact_1',
  contacts: [
    {
      id: 'contact_1',
      name: 'Ayesha Khan',
      status: 'online',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ayesha',
      lastMessage: 'Hey, let us review the design',
      lastTime: '10:42 AM'
    },
    {
      id: 'contact_2',
      name: 'Zain Ahmed',
      status: 'offline',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zain',
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

export class Store {
  constructor(initialState = INITIAL_STATE) {
    this.state = structuredClone(initialState);
    this.listeners = new Set();
  }

  /**
   * Returns current store state
   */
  getState() {
    return this.state;
  }

  /**
   * Subscribe to state updates
   * @param {Function} listener 
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all registered subscribers
   */
  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in store subscription listener:', error);
      }
    });
  }

  /**
   * Set active contact ID defensively (handles string ID or full contact object)
   * @param {string|Object} contactInput 
   */
  setActiveContact(contactInput) {
    const targetId = typeof contactInput === 'object' && contactInput !== null 
      ? contactInput.id 
      : contactInput;

    if (!targetId || typeof targetId !== 'string') {
      console.warn('setActiveContact expects a valid string ID.');
      return;
    }

    this.state.activeContactId = targetId;
    this.notify();
  }

  /**
   * Send message to current active contact
   * @param {string} text 
   */
  sendMessage(text) {
    const activeId = this.state.activeContactId;
    const cleanText = typeof text === 'string' ? text.trim() : '';

    if (!cleanText || !activeId) return;

    // Ensure array exists for active contact
    if (!Array.isArray(this.state.messages[activeId])) {
      this.state.messages[activeId] = [];
    }

    const newMessage = {
      id: `msg_${Date.now()}`,
      senderId: this.state.currentUser.id,
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.state.messages[activeId].push(newMessage);

    // Update conversation preview in sidebar
    const contact = this.state.contacts.find((c) => c.id === activeId);
    if (contact) {
      contact.lastMessage = cleanText;
      contact.lastTime = newMessage.timestamp;
    }

    this.notify();
  }
}

// Single instance export
export const store = new Store();
