/* ================================================================= *
 * Application Store - src/core/store.js                             *
 * ================================================================= */

import { mockData } from '../data/mock-data.js';

class Store {
  constructor() {
    this.state = {
      currentUser: mockData.currentUser,
      contacts: mockData.contacts,
      activeContactId: mockData.contacts[0]?.id || null,
      messages: mockData.messages
    };
    this.listeners = [];
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  setActiveContact(contactId) {
    this.state.activeContactId = contactId;
    this.notify();
  }

  sendMessage(text) {
    if (!text.trim() || !this.state.activeContactId) return;

    const newMessage = {
      id: 'm_' + Date.now(),
      senderId: this.state.currentUser.id,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (!this.state.messages[this.state.activeContactId]) {
      this.state.messages[this.state.activeContactId] = [];
    }

    this.state.messages[this.state.activeContactId].push(newMessage);
    this.notify();
  }
}

export const store = new Store();
