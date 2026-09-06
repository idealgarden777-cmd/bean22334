export const mockContacts = [
  {
    id: "contact_1",
    name: "Ayesha Khan",
    status: "Online",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
  },
  {
    id: "contact_2",
    name: "Zain Ahmed",
    status: "Last seen recently",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
  },
];

export const mockMessages = {
  contact_1: [
    {
      id: "m1",
      senderId: "contact_1",
      text: "Hi",
      timestamp: "04:34 PM",
    },
    {
      id: "m2",
      senderId: "user_1",
      text: "Hello! How are you doing?",
      timestamp: "04:35 PM",
    },
  ],

  contact_2: [
    {
      id: "m3",
      senderId: "contact_2",
      text: "Hey, are we still meeting?",
      timestamp: "02:10 PM",
    },
  ],
};
