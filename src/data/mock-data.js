"use strict";

/*
=========================================================
BEAN — MOCK DATA
=========================================================

Temporary frontend prototype data.

This file is the single source of mock data
until the backend is connected.

Components must NOT store their own mock data.
=========================================================
*/


/*
=========================================================
CONVERSATIONS
=========================================================
*/

export const mockConversations = [
  {
    id: "alex",
    beanId: "bean@alex",
    name: "Alex Morgan",
    initials: "AM",
    status: "online",
    preview: "Sounds good. See you tomorrow.",
    time: "9:42 AM",
  },

  {
    id: "sarah",
    beanId: "bean@sarah",
    name: "Sarah Khan",
    initials: "SK",
    status: "online",
    preview: "I sent you the latest files.",
    time: "8:18 AM",
  },

  {
    id: "daniel",
    beanId: "bean@daniel",
    name: "Daniel Lee",
    initials: "DL",
    status: "offline",
    preview: "Let me check and get back to you.",
    time: "Yesterday",
  },

  {
    id: "emma",
    beanId: "bean@emma",
    name: "Emma Wilson",
    initials: "EW",
    status: "online",
    preview: "Perfect, thank you!",
    time: "Yesterday",
  },

  {
    id: "bean-team",
    beanId: "bean@team",
    name: "Bean Team",
    initials: "BT",
    status: "online",
    preview: "The new prototype is ready.",
    time: "Mon",
  },
];


/*
=========================================================
MESSAGES
=========================================================
*/

export const mockMessages = {
  alex: [
    {
      id: "alex-1",
      conversationId: "alex",
      direction: "incoming",
      text: "Hey! How is the Bean prototype going?",
      time: "9:38 AM",
    },

    {
      id: "alex-2",
      conversationId: "alex",
      direction: "outgoing",
      text: "Going well. I am working on the chat interface now.",
      time: "9:40 AM",
    },

    {
      id: "alex-3",
      conversationId: "alex",
      direction: "incoming",
      text: "Sounds good. See you tomorrow.",
      time: "9:42 AM",
    },
  ],

  sarah: [
    {
      id: "sarah-1",
      conversationId: "sarah",
      direction: "incoming",
      text: "I sent you the latest files.",
      time: "8:18 AM",
    },
  ],

  daniel: [
    {
      id: "daniel-1",
      conversationId: "daniel",
      direction: "outgoing",
      text: "Can you review the latest version?",
      time: "Yesterday",
    },

    {
      id: "daniel-2",
      conversationId: "daniel",
      direction: "incoming",
      text: "Let me check and get back to you.",
      time: "Yesterday",
    },
  ],

  emma: [
    {
      id: "emma-1",
      conversationId: "emma",
      direction: "outgoing",
      text: "Everything has been updated.",
      time: "Yesterday",
    },

    {
      id: "emma-2",
      conversationId: "emma",
      direction: "incoming",
      text: "Perfect, thank you!",
      time: "Yesterday",
    },
  ],

  "bean-team": [
    {
      id: "bean-team-1",
      conversationId: "bean-team",
      direction: "incoming",
      text: "The new prototype is ready.",
      time: "Mon",
    },
  ],
};


/*
=========================================================
SAFE COPY HELPERS
=========================================================
*/

export function getMockConversations() {
  return mockConversations.map((conversation) => ({
    ...conversation,
  }));
}


export function getMockMessages() {
  const copy = {};

  Object.entries(mockMessages).forEach(
    ([conversationId, messages]) => {
      copy[conversationId] = messages.map(
        (message) => ({
          ...message,
        })
      );
    }
  );

  return copy;
}
