/* ================================================================= *
 * Store Core - src/core/store.js                                    *
 * ================================================================= */

import { initialContacts, initialMessages } from '../data/mock-data.js';

class Store {
  constructor() {
    this.state = {
      contacts: initialContacts || [],
      activeContact: null,
      messages: initialMessages || []
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  setActiveContact(contact) {
    this.setState({ activeContact: contact });
  }

  addMessage(message) {
    const messages = [...this.state.messages, { ...message, id: Date.now() }];
    this.setState({ messages });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const store = new Store();
