"use strict";

/* =========================================================
   BEAN — STORE
   Single source of truth for frontend state
   ========================================================= */

import {
  getMockConversations,
  getMockMessages,
} from "../data/mock-data.js";


/* =========================================================
   STATE
   ========================================================= */

const state = {
  view: "chats",
  selectedChatId: null,
  contactPanelOpen: false,
  conversations: getMockConversations(),
  messages: getMockMessages(),
};


/* =========================================================
   HELPERS
   ========================================================= */

function clone(value) {
  return structuredClone(value);
}


function normalizeText(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}


function findConversationIndex(id) {
  return state.conversations.findIndex(
    (conversation) =>
      conversation.id === id
  );
}


function isValidConversationId(id) {
  return findConversationIndex(id) !== -1;
}


/* =========================================================
   GLOBAL STATE
   ========================================================= */

export function getState() {
  return clone(state);
}


/* =========================================================
   VIEW
   ========================================================= */

export function getCurrentView() {
  return state.view;
}


export function setCurrentView(view) {
  const value = normalizeText(view);

  if (!value) {
    return false;
  }

  state.view = value;

  return true;
}


/* =========================================================
   CONVERSATIONS
   ========================================================= */

export function getConversations() {
  return clone(state.conversations);
}


export function getConversationById(id) {
  const conversation =
    state.conversations.find(
      (item) =>
        item.id === id
    );

  return conversation
    ? clone(conversation)
    : null;
}


export function getActiveConversationId() {
  return state.selectedChatId;
}


export function getActiveConversation() {
  if (!state.selectedChatId) {
    return null;
  }

  return getConversationById(
    state.selectedChatId
  );
}


export function setActiveConversation(id) {
  if (!isValidConversationId(id)) {
    return false;
  }

  if (
    state.selectedChatId !== id
  ) {
    state.contactPanelOpen = false;
  }

  state.selectedChatId = id;

  markConversationRead(id);

  return true;
}


export function clearActiveConversation() {
  state.selectedChatId = null;
  state.contactPanelOpen = false;
}


/* =========================================================
   UNREAD
   ========================================================= */

export function markConversationRead(id) {
  const index =
    findConversationIndex(id);

  if (index === -1) {
    return false;
  }

  state.conversations[index] = {
    ...state.conversations[index],
    unread: 0,
  };

  return true;
}


/* =========================================================
   MESSAGES
   ========================================================= */

export function getMessages(
  conversationId
) {
  if (!conversationId) {
    return [];
  }

  const conversationMessages =
    state.messages[conversationId];

  return conversationMessages
    ? clone(conversationMessages)
    : [];
}


/* =========================================================
   ADD MESSAGE

   Contract:
   addMessage(conversationId, messageObject)
   ========================================================= */

export function addMessage(
  conversationId,
  message
) {
  if (
    !isValidConversationId(
      conversationId
    )
  ) {
    return null;
  }

  if (
    !message ||
    typeof message !== "object"
  ) {
    return null;
  }


  const text =
    normalizeText(
      message.text
    );


  const file =
    message.file &&
    typeof message.file === "object"
      ? clone(message.file)
      : null;


  /*
   * A message must contain
   * text or a file.
   */

  if (!text && !file) {
    return null;
  }


  const newMessage = {
    id:
      normalizeText(
        message.id
      ) ||
      `${conversationId}-${Date.now()}`,

    conversationId,

    direction:
      message.direction === "incoming"
        ? "incoming"
        : "outgoing",

    text,

    time:
      normalizeText(
        message.time
      ),

    date:
      normalizeText(
        message.date
      ),

    seen:
      typeof message.seen === "boolean"
        ? message.seen
        : true,

    initials:
      normalizeText(
        message.initials
      ),

    reaction:
      normalizeText(
        message.reaction
      ),

    file,
  };


  if (
    !state.messages[
      conversationId
    ]
  ) {
    state.messages[
      conversationId
    ] = [];
  }


  state.messages[
    conversationId
  ].push(
    newMessage
  );


  updateConversationFromMessage(
    conversationId,
    newMessage
  );


  return clone(
    newMessage
  );
}


/* =========================================================
   CONVERSATION PREVIEW UPDATE
   ========================================================= */

function updateConversationFromMessage(
  conversationId,
  message
) {
  const index =
    findConversationIndex(
      conversationId
    );

  if (index === -1) {
    return;
  }


  const currentConversation =
    state.conversations[index];


  const preview =
    message.text ||
    (
      message.file
        ? `Shared ${
            message.file.name ||
            "a file"
          }`
        : ""
    );


  let unread =
    Number(
      currentConversation.unread || 0
    );


  /*
   * Incoming message only becomes unread
   * when that conversation is not active.
   */

  if (
    message.direction === "incoming" &&
    state.selectedChatId !==
      conversationId
  ) {
    unread += 1;
  }


  /*
   * Active conversation should never
   * display unread count.
   */

  if (
    state.selectedChatId ===
    conversationId
  ) {
    unread = 0;
  }


  state.conversations[index] = {
    ...currentConversation,
    preview,
    time:
      message.time ||
      currentConversation.time,
    unread,
  };
}


/* =========================================================
   CONTACT PANEL
   ========================================================= */

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

  return true;
}


export function toggleContactPanel() {
  if (!state.selectedChatId) {
    return false;
  }

  state.contactPanelOpen =
    !state.contactPanelOpen;

  return state.contactPanelOpen;
}


/* =========================================================
   RESET
   ========================================================= */

export function resetStore() {
  state.view = "chats";

  state.selectedChatId = null;

  state.contactPanelOpen = false;

  state.conversations =
    getMockConversations();

  state.messages =
    getMockMessages();
}
