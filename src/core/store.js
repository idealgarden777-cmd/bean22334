/* ================================================================= *
 * Simple State Store - src/core/store.js                            *
 * ================================================================= */

export const store = {
  state: {
    currentUser: {
      id: 'user_me',
      name: 'You'
    },

    activeContactId: 'contact_1',

    contacts: [
      {
        id: 'contact_1',
        name: 'Ayesha Khan',
        status: 'Online',
        avatar: 'https://i.pravatar.cc/150?img=47',
        isTyping: false
      },
      {
        id: 'contact_2',
        name: 'Zain Ahmed',
        status: 'Offline',
        avatar: 'https://i.pravatar.cc/150?img=12',
        isTyping: false
      }
    ],

    messages: {
      contact_1: [
        {
          id: 'msg_1',
          senderId: 'contact_1',
          text: 'Hi',
          timestamp: '04:34 PM',
          status: 'received'
        },
        {
          id: 'msg_2',
          senderId: 'user_me',
          text: 'Hello! How are you doing?',
          timestamp: '04:35 PM',
          status: 'sent'
        }
      ],

      contact_2: [
        {
          id: 'msg_3',
          senderId: 'contact_2',
          text: 'Hey, are we still meeting?',
          timestamp: '02:10 PM',
          status: 'received'
        }
      ]
    }
  },

  listeners: [],

  getState() {
    return this.state;
  },

  subscribe(listener) {
    if (typeof listener !== 'function') return;

    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(
        item => item !== listener
      );
    };
  },

  notify() {
    this.listeners.forEach(listener => {
      listener(this.state);
    });
  },

  setActiveContact(contactId) {
    const contact = this.state.contacts.find(
      item => item.id === contactId
    );

    if (!contact) return;

    this.state.activeContactId = contactId;
    this.notify();
  },

  sendMessage(text) {
    const messageText = String(text || '').trim();

    if (!messageText) return;

    const contactId = this.state.activeContactId;

    if (!contactId) return;

    if (!this.state.messages[contactId]) {
      this.state.messages[contactId] = [];
    }

    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    this.state.messages[contactId].push({
      id: `msg_${Date.now()}`,
      senderId: this.state.currentUser.id,
      text: messageText,
      timestamp: time,
      status: 'sent'
    });

    this.notify();

    this.simulateReply(contactId);
  },

  simulateReply(contactId) {
    const contact = this.state.contacts.find(
      item => item.id === contactId
    );

    if (!contact) return;

    setTimeout(() => {
      contact.isTyping = true;
      this.notify();

      setTimeout(() => {
        contact.isTyping = false;

        if (!this.state.messages[contactId]) {
          this.state.messages[contactId] = [];
        }

        this.state.messages[contactId].push({
          id: `reply_${Date.now()}`,
          senderId: contactId,
          text: 'Got it! Thanks for letting me know.',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          }),
          status: 'received'
        });

        this.notify();
      }, 1500);
    }, 700);
  }
};
