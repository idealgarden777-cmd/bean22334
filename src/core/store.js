// src/core/store.js

class ChatStore {
  constructor() {
    this.state = {
      currentUser: { id: 'u1', name: 'Yash', status: 'Online' },
      activeConversationId: '1',
      conversations: [
        { id: '1', name: 'General Channel', lastMessage: 'Welcome back! Your chat architecture is fully restored.', unread: 0 },
        { id: '2', name: 'Development Team', lastMessage: 'Build is passing successfully on Vercel!', unread: 0 },
        { id: '3', name: 'UI/UX Design Studio', lastMessage: 'Hexagon badges and layout synchronized.', unread: 0 }
      ],
      messages: {
        '1': [
          { id: 'm1', sender: 'Bean System', text: 'Welcome back! Your chat architecture is fully restored and running smoothly.', time: '10:00 AM' }
        ],
        '2': [
          { id: 'm2', sender: 'Dev Bot', text: 'Vercel deployment is stable and green.', time: '09:30 AM' }
        ],
        '3': [
          { id: 'm3', sender: 'Designer', text: 'Layout and responsive panes are ready.', time: 'Yesterday' }
        ]
      }
    };
    this.listeners = [];
  }

  getState() {
    return this.state;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  setActiveConversation(id) {
    this.state.activeConversationId = id;
    this.notify();
  }

  sendMessage(text) {
    const activeId = this.state.activeConversationId;
    if (!this.state.messages[activeId]) {
      this.state.messages[activeId] = [];
    }

    const newMessage = {
      id: 'm_' + Date.now(),
      sender: 'You',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.state.messages[activeId].push(newMessage);

    // Update last message in conversation list
    const conv = this.state.conversations.find(c => c.id === activeId);
    if (conv) {
      conv.lastMessage = text;
    }

    this.notify();
  }
}

export const store = new ChatStore();
