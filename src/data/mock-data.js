"use strict";

/* =========================================================
   BEAN — MOCK DATA
   Single source of prototype conversation data
   ========================================================= */


/* =========================================================
   CONVERSATIONS
   ========================================================= */

const conversations = [
  {
    id: "alex",
    beanId: "bean@alex",
    name: "Alex Morgan",
    initials: "AM",
    status: "online",
    avatar: "",
    preview: "Sounds good. See you tomorrow.",
    time: "9:42 AM",
    unread: 2,
    about: "Product designer working on digital experiences.",
    files: [
      {
        id: "alex-file-1",
        name: "Bean_UI_Notes.pdf",
        size: "1.8 MB",
        type: "PDF",
      },
    ],
    media: [],
  },

  {
    id: "sarah",
    beanId: "bean@sarah",
    name: "Sarah Khan",
    initials: "SK",
    status: "online",
    avatar: "",
    preview: "I sent you the latest files.",
    time: "8:18 AM",
    unread: 0,
    about: "Frontend developer and product collaborator.",
    files: [
      {
        id: "sarah-file-1",
        name: "Latest_Files.zip",
        size: "4.2 MB",
        type: "ZIP",
      },
    ],
    media: [],
  },

  {
    id: "daniel",
    beanId: "bean@daniel",
    name: "Daniel Lee",
    initials: "DL",
    status: "offline",
    avatar: "",
    preview: "Let me check and get back to you.",
    time: "Yesterday",
    unread: 0,
    about: "Engineering and infrastructure.",
    files: [],
    media: [],
  },

  {
    id: "emma",
    beanId: "bean@emma",
    name: "Emma Wilson",
    initials: "EW",
    status: "online",
    avatar: "",
    preview: "Perfect, thank you!",
    time: "Yesterday",
    unread: 1,
    about: "Brand and communication specialist.",
    files: [],
    media: [],
  },

  {
    id: "bean-team",
    beanId: "bean@team",
    name: "Bean Team",
    initials: "BT",
    status: "online",
    avatar: "",
    preview: "The new prototype is ready.",
    time: "Mon",
    unread: 0,
    about: "Official Bean product team conversation.",
    files: [
      {
        id: "bean-team-file-1",
        name: "Bean_Prototype_v1.pdf",
        size: "2.6 MB",
        type: "PDF",
      },
    ],
    media: [],
  },
];


/* =========================================================
   MESSAGES
   ========================================================= */

const messages = {
  alex: [
    {
      id: "alex-1",
      conversationId: "alex",
      direction: "incoming",
      text: "Hey! How is the Bean prototype going?",
      time: "9:38 AM",
      date: "Today",
      seen: true,
      initials: "AM",
    },

    {
      id: "alex-2",
      conversationId: "alex",
      direction: "outgoing",
      text: "Going well. I am working on the new chat interface now.",
      time: "9:40 AM",
      date: "Today",
      seen: true,
    },

    {
      id: "alex-3",
      conversationId: "alex",
      direction: "incoming",
      text: "Sounds good. See you tomorrow.",
      time: "9:42 AM",
      date: "Today",
      seen: true,
      initials: "AM",
    },
  ],


  sarah: [
    {
      id: "sarah-1",
      conversationId: "sarah",
      direction: "incoming",
      text: "I sent you the latest files.",
      time: "8:18 AM",
      date: "Today",
      seen: true,
      initials: "SK",
      file: {
        id: "sarah-message-file-1",
        name: "Latest_Files.zip",
        size: "4.2 MB",
        type: "ZIP",
      },
    },
  ],


  daniel: [
    {
      id: "daniel-1",
      conversationId: "daniel",
      direction: "outgoing",
      text: "Can you review the latest version?",
      time: "Yesterday",
      date: "Yesterday",
      seen: true,
    },

    {
      id: "daniel-2",
      conversationId: "daniel",
      direction: "incoming",
      text: "Let me check and get back to you.",
      time: "Yesterday",
      date: "Yesterday",
      seen: true,
      initials: "DL",
    },
  ],


  emma: [
    {
      id: "emma-1",
      conversationId: "emma",
      direction: "outgoing",
      text: "Everything has been updated.",
      time: "Yesterday",
      date: "Yesterday",
      seen: true,
    },

    {
      id: "emma-2",
      conversationId: "emma",
      direction: "incoming",
      text: "Perfect, thank you!",
      time: "Yesterday",
      date: "Yesterday",
      seen: true,
      initials: "EW",
      reaction: "👍 1",
    },
  ],


  "bean-team": [
    {
      id: "bean-team-1",
      conversationId: "bean-team",
      direction: "incoming",
      text: "The new prototype is ready.",
      time: "Mon",
      date: "Monday",
      seen: true,
      initials: "BT",
      file: {
        id: "bean-team-message-file-1",
        name: "Bean_Prototype_v1.pdf",
        size: "2.6 MB",
        type: "PDF",
      },
    },

    {
      id: "bean-team-2",
      conversationId: "bean-team",
      direction: "outgoing",
      text: "Great. I will review the UI and keep the new design system consistent.",
      time: "Mon",
      date: "Monday",
      seen: true,
    },
  ],
};


/* =========================================================
   CLONE
   ========================================================= */

function clone(value) {
  return structuredClone(value);
}


/* =========================================================
   PUBLIC GETTERS
   ========================================================= */

export function getMockConversations() {
  return clone(conversations);
}


export function getMockMessages() {
  return clone(messages);
}


/* =========================================================
   OPTIONAL RAW EXPORTS
   Useful for debugging only.
   Do not mutate these directly.
   ========================================================= */

export {
  conversations,
  messages,
};
