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

  getState() { return this.state; }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  setState(partialState) {
    this.state = { ...this.state, ...partialState };
    this.listeners.forEach(listener => listener(this.state));
  }

  setActiveContact(contactId) {
    const contacts = this.state.contacts.map(c => c.id === contactId ? { ...c, unreadCount: 0 } : c);
    this.setState({ activeContactId: contactId, contacts });
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
    const list = this.state.messages[this.state.activeContactId] || [];
    this.setState({
      messages: { ...this.state.messages, [this.state.activeContactId]: [...list, newMessage] }
    });
  }

  setSearchQuery(query) { this.setState({ searchQuery: query }); }
  toggleContactPanel() { this.setState({ isContactPanelOpen: !this.state.isContactPanelOpen }); }
}

export const store = new Store();
