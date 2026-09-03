"use strict";

import {
  getMockConversations,
  getMockMessages,
} from "../data/mock-data.js";

const state = {
  view: "chats",
  selectedChatId: null,
  contactPanelOpen: false,
  conversations: getMockConversations(),
  messages: getMockMessages(),
};

function clone(value) {
  return structuredClone(value);
}

export function getState() {
  return clone(state);
}

export function getCurrentView() {
  return state.view;
}

export function setCurrentView(view) {
  if (typeof view !== "string" || !view.trim()) {
    return false;
  }

  state.view = view.trim();
  return true;
}

export function getConversations() {
  return clone(state.conversations);
}

export function getConversationById(id) {
  const conversation = state.conversations.find(
    (item) => item.id === id
  );

  return conversation ? clone(conversation) : null;
}

export function getActiveConversation() {
  if (!state.selectedChatId) {
    return null;
  }

  return getConversationById(state.selectedChatId);
}

export function getActiveConversationId() {
  return state.selectedChatId;
}

export function setActiveConversation(id) {
  const conversation = state.conversations.find(
    (item) => item.id === id
  );

  if (!conversation) {
    return false;
  }

  if (state.selectedChatId !== id) {
    state.contactPanelOpen = false;
  }

  state.selectedChatId = id;

  return true;
}

export function clearActiveConversation() {
  state.selectedChatId = null;
  state.contactPanelOpen = false;
}

export function getMessages(conversationId) {
  const messages = state.messages[conversationId];

  return messages ? clone(messages) : [];
}

export function addMessage(conversationId, message) {
  const conversation = state.conversations.find(
    (item) => item.id === conversationId
  );

  if (!conversation) {
    return false;
  }

  const text =
    typeof message?.text === "string"
      ? message.text.trim()
      : "";

  if (!text) {
    return false;
  }

  const newMessage = {
    id:
      message.id ??
      `${conversationId}-${Date.now()}`,

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

  if (!state.messages[conversationId]) {
    state.messages[conversationId] = [];
  }

  state.messages[conversationId].push(newMessage);

  updateConversationPreview(
    conversationId,
    newMessage
  );

  return clone(newMessage);
}

function updateConversationPreview(
  conversationId,
  message
) {
  const index = state.conversations.findIndex(
    (item) => item.id === conversationId
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

export function isContactPanelOpen() {
  return state.contactPanelOpen;
}

export function openContactPanel() {
  if (!state.selectedChatId) {
    return false;
  }

  state.contactPanelOpen = true;
  return true;
}

export function closeContactPanel() {
  state.contactPanelOpen = false;
}

export function toggleContactPanel() {
  if (!state.selectedChatId) {
    return false;
  }

  state.contactPanelOpen =
    !state.contactPanelOpen;

  return state.contactPanelOpen;
}

export function resetStore() {
  state.view = "chats";
  state.selectedChatId = null;
  state.contactPanelOpen = false;
  state.conversations = getMockConversations();
  state.messages = getMockMessages();
}
