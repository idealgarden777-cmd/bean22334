export const currentUser = {
  id: 'user_me',
  name: 'Yash',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=256'
};

export const mockContacts = [
  {
    id: 'contact_1',
    name: 'Elena Rostova',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
    status: 'online',
    role: 'Lead Designer',
    bio: 'Crafting minimalist user experiences and design systems.',
    phone: '+1 (555) 234-5678',
    email: 'elena.rostova@design.co'
  },
  {
    id: 'contact_2',
    name: 'Liam Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
    status: 'offline',
    role: 'Frontend Engineer',
    bio: 'Building fast, accessible web applications.',
    phone: '+1 (555) 876-5432',
    email: 'liam.vance@tech.io'
  },
  {
    id: 'contact_3',
    name: 'Sophia Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256',
    status: 'online',
    role: 'Product Manager',
    bio: 'Bridging user needs with elegant tech solutions.',
    phone: '+1 (555) 345-6789',
    email: 'sophia.chen@product.com'
  }
];

export const mockMessages = {
  contact_1: [
    {
      id: 'msg_101',
      senderId: 'contact_1',
      text: 'Hey! Have you had a chance to check the updated typography tokens?',
      timestamp: '10:30 AM',
      status: 'read'
    },
    {
      id: 'msg_102',
      senderId: 'user_me',
      text: 'Yes, looking at them right now. The warm palette contrast is spot on.',
      timestamp: '10:35 AM',
      status: 'read'
    },
    {
      id: 'msg_103',
      senderId: 'contact_1',
      text: 'The new design tokens look clean! Let us review tomorrow.',
      timestamp: '10:42 AM',
      status: 'delivered'
    }
  ],
  contact_2: [
    {
      id: 'msg_201',
      senderId: 'contact_2',
      text: 'Hey, I checked the repository configuration for Vercel.',
      timestamp: 'Yesterday',
      status: 'read'
    },
    {
      id: 'msg_202',
      senderId: 'user_me',
      text: 'Great, thanks Liam! Vite build issue resolved on the main branch.',
      timestamp: 'Yesterday',
      status: 'read'
    }
  ],
  contact_3: [
    {
      id: 'msg_301',
      senderId: 'contact_3',
      text: 'Can you share the updated color system spec?',
      timestamp: 'Sep 2',
      status: 'read'
    }
  ]
};
