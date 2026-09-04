export const mockChats = [
  {
    id: 'chat_1',
    name: 'Ayesha Khan',
    avatar: 'https://i.pravatar.cc/150?img=47',
    status: 'online',
    lastMessage: 'Hello! How are you doing?',
    lastMessageTime: '04:35 PM'
  },
  {
    id: 'chat_2',
    name: 'Zain Ahmed',
    avatar: 'https://i.pravatar.cc/150?img=12',
    status: 'offline',
    lastMessage: 'Hey, are we still meeting?',
    lastMessageTime: '02:10 PM'
  }
];

export const mockMessages = {
  chat_1: [
    {
      id: 'msg_1',
      senderId: 'contact_1',
      text: 'Hi',
      timestamp: '04:34 PM',
      status: 'received'
    },
    {
      id: 'msg_2',
      senderId: 'user_me',
      text: 'Hello! How are you doing?',
      timestamp: '04:35 PM',
      status: 'sent'
    }
  ],

  chat_2: [
    {
      id: 'msg_3',
      senderId: 'contact_2',
      text: 'Hey, are we still meeting?',
      timestamp: '02:10 PM',
      status: 'received'
    }
  ]
};

export const mockContacts = [
  {
    id: 'contact_1',
    name: 'Ayesha Khan',
    avatar: 'https://i.pravatar.cc/150?img=47',
    status: 'online'
  },
  {
    id: 'contact_2',
    name: 'Zain Ahmed',
    avatar: 'https://i.pravatar.cc/150?img=12',
    status: 'offline'
  }
];
