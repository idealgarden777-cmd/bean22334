/* ================================================================= *
 * Mock Data - src/data/mock-data.js
 * ================================================================= */

export const mockChats = [
  {
    id: 'contact_1',
    name: 'Ayesha Khan',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    status: 'Online',
    lastSeen: 'Active now',
    lastMessage: 'Hello! How are you doing?',
    lastMessageTime: '04:35 PM',
    isTyping: false
  },
  {
    id: 'contact_2',
    name: 'Zain Ahmed',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    status: 'Last seen recently',
    lastSeen: 'Recently',
    lastMessage: 'Hey, are we still meeting?',
    lastMessageTime: '02:10 PM',
    isTyping: false
  }
];

export const mockMessages = {
  contact_1: [
    {
      id: 'm1',
      senderId: 'contact_1',
      text: 'hi',
      timestamp: '04:34 PM'
    },
    {
      id: 'm2',
      senderId: 'user_1',
      text: 'Hello! How are you doing?',
      timestamp: '04:35 PM'
    }
  ],

  contact_2: [
    {
      id: 'm3',
      senderId: 'contact_2',
      text: 'Hey, are we still meeting?',
      timestamp: '02:10 PM'
    }
  ]
};

export const mockContacts = [
  {
    id: 'contact_1',
    name: 'Ayesha Khan',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    status: 'Online',
    lastSeen: 'Active now',
    isTyping: false
  },
  {
    id: 'contact_2',
    name: 'Zain Ahmed',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    status: 'Last seen recently',
    lastSeen: 'Recently',
    isTyping: false
  }
];

export const mockData = {
  currentUser: {
    id: 'user_1',
    name: 'You',
    avatar:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  },
  chats: mockChats,
  messages: mockMessages,
  contacts: mockContacts
};
