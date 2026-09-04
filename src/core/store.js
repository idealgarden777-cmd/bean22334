/* =================================================================
   Central Store & State Management
   ================================================================ */

import { initialData } from '../data/mock-data.js';

class Store {
  constructor() {
    this.state = {
      currentUser: initialData.currentUser,
      contacts: initialData.contacts,
      messages: initialData.messages,
      activeContactId: initialData.contacts[0].id,
      searchQuery: '',
      isContactPanelOpen: true
    };
    this.listeners = [];
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.listeners.forEach(listener => listener(this.state));
  }

  setActiveContact(contactId) {
    // Reset unread count for selected contact
    const updatedContacts = this.state.contacts.map(contact => {
      if (contact.id === contactId) {
        return { ...contact, unreadCount: 0 };
      }
      return contact;
    });

    this.setState({
      activeContactId: contactId,
      contacts: updatedContacts
    });
  }

  sendMessage(text) {
    if (!text.trim()) return;

    const newMessage = {
      id: 'm_' + Date.now(),
      senderId: this.state.currentUser.id,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    const contactMessages = this.state.messages[this.state.activeContactId] || [];
    
    this.setState({
      messages: {
        ...this.state.messages,
        [this.state.activeContactId]: [...contactMessages, newMessage]
      }
    });
  }

  setSearchQuery(query) {
    this.setState({ searchQuery: query });
  }

  toggleContactPanel() {
    this.setState({ isContactPanelOpen: !this.state.isContactPanelOpen });
  }
}

export const store = new Store();
