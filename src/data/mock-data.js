"use strict";

export const conversations = [
  { id: "alex", beanId: "bean@alex", name: "Alex Morgan", initials: "AM", status: "online", preview: "Sounds good. See you tomorrow.", time: "9:42 AM" },
  { id: "sarah", beanId: "bean@sarah", name: "Sarah Khan", initials: "SK", status: "online", preview: "I sent you the latest files.", time: "8:18 AM" },
  { id: "daniel", beanId: "bean@daniel", name: "Daniel Lee", initials: "DL", status: "offline", preview: "Let me check and get back to you.", time: "Yesterday" },
  { id: "emma", beanId: "bean@emma", name: "Emma Wilson", initials: "EW", status: "online", preview: "Perfect, thank you!", time: "Yesterday" },
  { id: "bean-team", beanId: "bean@team", name: "Bean Team", initials: "BT", status: "online", preview: "The new prototype is ready.", time: "Mon" }
];

export const messages = {
  alex: [
    { id: "alex-1", direction: "incoming", text: "Hey! How is the Bean prototype going?", time: "9:38 AM" },
    { id: "alex-2", direction: "outgoing", text: "Going well. I am working on the chat interface now.", time: "9:40 AM" },
    { id: "alex-3", direction: "incoming", text: "Sounds good. See you tomorrow.", time: "9:42 AM" }
  ],
  sarah: [
    { id: "sarah-1", direction: "incoming", text: "I sent you the latest files.", time: "8:18 AM" }
  ],
  daniel: [
    { id: "daniel-1", direction: "outgoing", text: "Can you review the latest version?", time: "Yesterday" },
    { id: "daniel-2", direction: "incoming", text: "Let me check and get back to you.", time: "Yesterday" }
  ],
  emma: [
    { id: "emma-1", direction: "outgoing", text: "Everything has been updated.", time: "Yesterday" },
    { id: "emma-2", direction: "incoming", text: "Perfect, thank you!", time: "Yesterday" }
  ],
  "bean-team": [
    { id: "bean-team-1", direction: "incoming", text: "The new prototype is ready.", time: "Mon" }
  ]
};
