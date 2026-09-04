/* ================================================================= *
 * State Store - src/core/store.js                                   *
 * ================================================================= */

export const store = {
  state: {
    currentUser: { id: 'user_1', name: 'You' },
    activeContactId: 'contact_1',
    contacts: [
      { id: 'contact_1', name: 'Ayesha Khan', status: 'Online', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', isTyping: false },
      { id: 'contact_2', name: 'Zain Ahmed', status: 'Last seen recently', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', isTyping: false }
    ],
    messages: {
      'contact_1': [
        { id: 'm1', senderId: 'contact_1', text: 'hi', timestamp: '04:34 PM' },
        { id: 'm2', senderId: 'user_1', text: 'Hello! How are you doing?', timestamp: '04:35 PM' }
      ],
      'contact_2': [
        { id: 'm3', senderId: 'contact_2', text: 'Hey, are we still meeting?', timestamp: '02:10 PM' }
      ]
    }
  },
  listeners: [],
  getState() {
    return this.state;
  },
  subscribe(listener) {
    this.listeners.push(listener);
  },
  notify() {
    this.listeners.forEach(l => l(this.state));
  },
  setActiveContact(contactId) {
    this.state.activeContactId = contactId;
    this.notify();
  },
  sendMessage(text) {
    if (!this.state.activeContactId) return;
    const contactId = this.state.activeContactId;
    if (!this.state.messages[contactId]) {
      this.state.messages[contactId] = [];
    }
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    this.state.messages[contactId].push({
      id: 'm_' + Date.now(),
      senderId: this.state.currentUser.id,
      text: text,
      timestamp: timeString
    });
    this.notify();

    // Simulate reply & typing indicator
    setTimeout(() => {
      const contact = this.state.contacts.find(c => c.id === contactId);
      if (contact) contact.isTyping = true;
      this.notify();

      setTimeout(() => {
        if (contact) contact.isTyping = false;
        this.state.messages[contactId].push({
          id: 'm_reply_' + Date.now(),
          senderId: contactId,
          text: 'Got it! Thanks for letting me know.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        this.notify();
      }, 2000);
    }, 1000);
  }
};
