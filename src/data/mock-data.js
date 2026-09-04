/* ================================================================= *
 * Mock Data - src/data/mock-data.js                                 *
 * ================================================================= */

export const mockData = {
  currentUser: {
    id: 'user-0',
    name: 'Alex Morgan',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
  },
  contacts: [
    {
      id: 'user-1',
      name: 'Sarah Jenkins',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      status: 'Online',
      lastSeen: 'Active now'
    },
    {
      id: 'user-2',
      name: 'Design Team Chat',
      avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
      status: '4 members',
      lastSeen: 'Active 2h ago'
    },
    {
      id: 'user-3',
      name: 'Liam Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      status: 'Offline',
      lastSeen: 'Yesterday'
    }
  ],
  messages: {
    'user-1': [
      { id: 'm1', senderId: 'user-1', text: 'Hey! Did you check out the new warm minimal design tokens?', timestamp: '10:42 AM' },
      { id: 'm2', senderId: 'user-0', text: 'Yes, looking clean with Sora SemiBold and the bone background.', timestamp: '10:44 AM' },
      { id: 'm3', senderId: 'user-1', text: 'Awesome! Let’s lock in the components next.', timestamp: '10:45 AM' }
    ],
    'user-2': [
      { id: 'm4', senderId: 'user-2', text: 'Welcome to the design system sync!', timestamp: '9:00 AM' }
    ],
    'user-3': [
      { id: 'm5', senderId: 'user-3', text: 'Catch you later.', timestamp: 'Yesterday' }
    ]
  }
};
