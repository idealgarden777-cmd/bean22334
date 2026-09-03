"use strict";

/*
=========================================================
BEAN — FRONTEND STORE
=========================================================

Single source of truth for frontend prototype state.

Owns:
- Current navigation view
- Active conversation
- Contact panel state
- Conversation collection
- Message collection

Does not own:
- DOM rendering
- UI events
- Backend
- Realtime
=========================================================
*/

import {
  getMockConversations,
  getMockMessages,
} from "../data/mock-data.js";


/*
=========================================================
INITIAL STATE
=========================================================
*/

const initialState = {
  currentView: "chats",
  activeConversationId: null,
  isContactPanelOpen: false,
  conversations: getMockConversations(),
  messages: getMockMessages(),
};


/*
=========================================================
STATE
=========================================================
*/

let state = createStateCopy(initialState);


/*
=========================================================
HELPERS
=========================================================
*/

function createStateCopy(source) {
  return {
    currentView: source.currentView,
    activeConversationId:
      source.activeConversationId,
    isContactPanelOpen:
      source.isContactPanelOpen,

    conversations:
      source.conversations.map(
        (conversation) => ({
          ...conversation,
        })
      ),

    messages:
      Object.fromEntries(
        Object.entries(source.messages).map(
          ([conversationId, messages]) => [
            conversationId,
            messages.map((message) => ({
              ...message,
            })),
          ]
        )
      ),
  };
}


function isValidId(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}


function getConversationIndex(id) {
  return state.conversations.findIndex(
    (conversation) =>
      conversation.id === id
  );
}


/*
=========================================================
READ STATE
=========================================================
*/

export function getState() {
  return createStateCopy(state);
}


export function getCurrentView() {
  return state.currentView;
}


export function getConversations() {
  return state.conversations.map(
    (conversation) => ({
      ...conversation,
    })
  );
}


export function getConversationById(id) {
  if (!isValidId(id)) {
    return null;
  }

  const conversation =
    state.conversations.find(
      (item) => item.id === id
    );

  return conversation
    ? { ...conversation }
    : null;
}


export function getActiveConversation() {
  if (!state.activeConversationId) {
    return null;
  }

  return getConversationById(
    state.activeConversationId
  );
}


export function getMessages(
  conversationId
) {
  if (!isValidId(conversationId)) {
    return [];
  }

  const messages =
    state.messages[conversationId] ?? [];

  return messages.map((message) => ({
    ...message,
  }));
}


export function isContactPanelOpen() {
  return state.isContactPanelOpen;
}


/*
=========================================================
NAVIGATION
=========================================================
*/

export function setCurrentView(view) {
  if (!isValidId(view)) {
    return false;
  }

  state.currentView = view;

  return true;
}


/*
=========================================================
ACTIVE CONVERSATION
=========================================================
*/

export function setActiveConversation(
  conversationId
) {
  if (!isValidId(conversationId)) {
    return false;
  }

  const conversation =
    getConversationById(conversationId);

  if (!conversation) {
    return false;
  }

  const conversationChanged =
    state.activeConversationId !==
    conversationId;

  state.activeConversationId =
    conversationId;

  if (conversationChanged) {
    state.isContactPanelOpen = false;
  }

  return true;
}


export function clearActiveConversation() {
  state.activeConversationId = null;
  state.isContactPanelOpen = false;
}


/*
=========================================================
CONTACT PANEL
=========================================================
*/

export function openContactPanel() {
  if (!state.activeConversationId) {
    return false;
  }

  state.isContactPanelOpen = true;

  return true;
}


export function closeContactPanel() {
  state.isContactPanelOpen = false;

  return true;
}


export function toggleContactPanel() {
  if (!state.activeConversationId) {
    return false;
  }

  state.isContactPanelOpen =
    !state.isContactPanelOpen;

  return true;
}


/*
=========================================================
MESSAGES
=========================================================
*/

export function addMessage(
  conversationId,
  message
) {
  if (
    !isValidId(conversationId) ||
    !message ||
    typeof message !== "object"
  ) {
    return false;
  }

  const conversation =
    getConversationById(conversationId);

  if (!conversation) {
    return false;
  }

  const text =
    typeof message.text === "string"
      ? message.text.trim()
      : "";

  if (!text) {
    return false;
  }

  if (!state.messages[conversationId]) {
    state.messages[conversationId] = [];
  }

  const newMessage = {
    id:
      isValidId(message.id)
        ? message.id
        : `${conversationId}-${Date.now()}`,

    conversationId,

    direction:
      message.direction === "incoming"
        ? "incoming"
        : "outgoing",

    text,

    time:
      typeof message.time === "string"
        ? message.time
        : "",
  };

  state.messages[
    conversationId
  ].push(newMessage);

  updateConversationPreview(
    conversationId,
    newMessage
  );

  return {
    ...newMessage,
  };
}


/*
=========================================================
CONVERSATION PREVIEW
=========================================================
*/

function updateConversationPreview(
  conversationId,
  message
) {
  const index =
    getConversationIndex(
      conversationId
    );

  if (index === -1) {
    return;
  }

  state.conversations[index] = {
    ...state.conversations[index],
    preview: message.text,
    time: message.time,
  };
}


/*
=========================================================
RESET STORE
=========================================================
*/

export function resetStore() {
  state =
    createStateCopy(initialState);
}
