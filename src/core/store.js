```javascript
/* =========================================================
   BEAN — CENTRAL STORE
   src/core/store.js

   Single source of truth for:
   - current user
   - contacts / conversations
   - active contact
   - messages
   - subscriptions
   - sending messages
   ========================================================= */

import { mockData } from '../data/mock-data.js';

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function createMessageId(prefix = 'msg') {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* ---------------------------------------------------------
   INITIAL STATE
   --------------------------------------------------------- */

const initialData = clone(mockData);

const initialContacts = initialData.contacts.map((contact) => ({
  ...contact,
  lastMessage:
    contact.lastMessage ??
    initialData.messages?.[contact.id]?.at(-1)?.text ??
    '',
  lastTime:
    contact.lastTime ??
    initialData.messages?.[contact.id]?.at(-1)?.timestamp ??
    '',
  isTyping: false,
  unread: Number(contact.unread || 0)
}));

const initialMessages = initialData.messages || {};

const state = {
  currentUser: {
    id: initialData.currentUser.id,
    name: initialData.currentUser.name,
    avatar: initialData.currentUser.avatar || ''
  },

  contacts: initialContacts,

  messages: initialMessages,

  activeContactId:
    initialContacts[0]?.id ?? null
};

const listeners = new Set();

/* ---------------------------------------------------------
   CORE STORE
   --------------------------------------------------------- */

export const store = {
  state,

  getState() {
    return this.state;
  },

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  notify() {
    listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error(
          '[Bean Store] Listener error:',
          error
        );
      }
    });
  },

  /* -------------------------------------------------------
     CONTACTS
     ------------------------------------------------------- */

  getActiveContact() {
    return (
      this.state.contacts.find(
        (contact) =>
          contact.id === this.state.activeContactId
      ) || null
    );
  },

  setActiveContact(contactId) {
    if (
      contactId !== null &&
      !this.state.contacts.some(
        (contact) => contact.id === contactId
      )
    ) {
      return;
    }

    this.state.activeContactId = contactId;

    if (contactId) {
      const contact = this.state.contacts.find(
        (item) => item.id === contactId
      );

      if (contact) {
        contact.unread = 0;
      }
    }

    this.notify();
  },

  /* -------------------------------------------------------
     MESSAGES
     ------------------------------------------------------- */

  getMessages(contactId = this.state.activeContactId) {
    if (!contactId) {
      return [];
    }

    if (!Array.isArray(this.state.messages[contactId])) {
      this.state.messages[contactId] = [];
    }

    return this.state.messages[contactId];
  },

  sendMessage(text) {
    const cleanText = String(text ?? '').trim();

    if (!cleanText) {
      return false;
    }

    const contactId = this.state.activeContactId;

    if (!contactId) {
      return false;
    }

    const messages = this.getMessages(contactId);

    const message = {
      id: createMessageId('user'),
      senderId: this.state.currentUser.id,
      text: cleanText,
      timestamp: formatTime()
    };

    messages.push(message);

    this.updateContactPreview(contactId, cleanText);

    this.notify();

    this.simulateReply(contactId);

    return true;
  },

  simulateReply(contactId) {
    const contact = this.state.contacts.find(
      (item) => item.id === contactId
    );

    if (!contact) {
      return;
    }

    contact.isTyping = true;
    this.notify();

    window.setTimeout(() => {
      const activeContact = this.state.contacts.find(
        (item) => item.id === contactId
      );

      if (activeContact) {
        activeContact.isTyping = false;
      }

      const replyMessages =
        this.getMessages(contactId);

      const reply = {
        id: createMessageId('reply'),
        senderId: contactId,
        text: 'Got it! Thanks for letting me know.',
        timestamp: formatTime()
      };

      replyMessages.push(reply);

      this.updateContactPreview(
        contactId,
        reply.text
      );

      this.notify();
    }, 1800);
  },

  clearMessages(contactId = this.state.activeContactId) {
    if (!contactId) {
      return;
    }

    this.state.messages[contactId] = [];

    this.updateContactPreview(contactId, '');

    this.notify();
  },

  updateContactPreview(contactId, text) {
    const contact = this.state.contacts.find(
      (item) => item.id === contactId
    );

    if (!contact) {
      return;
    }

    contact.lastMessage = String(text ?? '');
    contact.lastTime = text ? formatTime() : '';
  },

  /* -------------------------------------------------------
     SEARCH / CONVERSATIONS
     ------------------------------------------------------- */

  getConversations() {
    return this.state.contacts.map((contact) => ({
      ...contact,
      preview:
        contact.lastMessage ||
        this.getMessages(contact.id).at(-1)?.text ||
        'Start a conversation',
      time:
        contact.lastTime ||
        this.getMessages(contact.id).at(-1)?.timestamp ||
        ''
    }));
  },

  getActiveConversationId() {
    return this.state.activeContactId;
  },

  setActiveConversation(conversationId) {
    this.setActiveContact(conversationId);
  }
};

/* ---------------------------------------------------------
   NAMED EXPORTS
   These keep imports predictable across components.
   --------------------------------------------------------- */

export function getConversations() {
  return store.getConversations();
}

export function getActiveConversationId() {
  return store.getActiveConversationId();
}

export function setActiveConversation(conversationId) {
  store.setActiveConversation(conversationId);
}

export function getState() {
  return store.getState();
}

export function subscribe(listener) {
  return store.subscribe(listener);
}

export function setActiveContact(contactId) {
  return store.setActiveContact(contactId);
}

export function getActiveContact() {
  return store.getActiveContact();
}

export function getMessages(contactId) {
  return store.getMessages(contactId);
}

export function sendMessage(text) {
  return store.sendMessage(text);
}

export function clearMessages(contactId) {
  return store.clearMessages(contactId);
}
```
