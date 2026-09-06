export const store = {
  state: {
    currentUser: {
      id: "user_1",
      name: "You",
    },

    activeContactId: "contact_1",

    contacts: [
      {
        id: "contact_1",
        name: "Ayesha Khan",
        status: "Online",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
      },
      {
        id: "contact_2",
        name: "Zain Ahmed",
        status: "Last seen recently",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      },
    ],

    messages: {
      contact_1: [
        {
          id: "m1",
          senderId: "contact_1",
          text: "Hi",
          timestamp: "04:34 PM",
        },
        {
          id: "m2",
          senderId: "user_1",
          text: "Hello! How are you doing?",
          timestamp: "04:35 PM",
        },
      ],

      contact_2: [
        {
          id: "m3",
          senderId: "contact_2",
          text: "Hey, are we still meeting?",
          timestamp: "02:10 PM",
        },
      ],
    },
  },

  listeners: new Set(),

  getState() {
    return this.state;
  },

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify() {
    this.listeners.forEach((listener) => listener(this.state));
  },

  setActiveContact(contactId) {
    const exists = this.state.contacts.some(
      (contact) => contact.id === contactId
    );

    if (!exists) return;

    this.state.activeContactId = contactId;
    this.notify();
  },

  getActiveContact() {
    return this.state.contacts.find(
      (contact) => contact.id === this.state.activeContactId
    );
  },

  getActiveMessages() {
    return this.state.messages[this.state.activeContactId] || [];
  },

  sendMessage(text) {
    const cleanText = text.trim();
    if (!cleanText) return;

    const contactId = this.state.activeContactId;

    if (!this.state.messages[contactId]) {
      this.state.messages[contactId] = [];
    }

    this.state.messages[contactId].push({
      id: `m_${Date.now()}`,
      senderId: this.state.currentUser.id,
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    this.notify();
  },
};
