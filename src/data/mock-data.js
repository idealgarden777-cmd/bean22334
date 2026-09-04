/* ================================================================= *
 * Mock Data - src/data/mock-data.js                                 *
 * ================================================================= */

export const initialContacts = [
  {
    id: 1,
    name: 'Alex Morgan',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    status: 'Online',
    lastMessage: 'Hey, are we still on for the design review?',
    lastTime: '10:42 AM',
    isTyping: false
  },
  {
    id: 2,
    name: 'Sarah Chen',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    status: 'Last seen today at 9:15 AM',
    lastMessage: 'The new color palette looks amazing!',
    lastTime: 'Yesterday',
    isTyping: false
  },
  {
    id: 3,
    name: 'Marcus Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    status: 'Busy',
    lastMessage: 'Will check the repository updates soon.',
    lastTime: 'Tuesday',
    isTyping: false
  }
];

export const initialMessages = [
  { id: 1, sender: 'contact', text: 'Hey, are we still on for the design review?' },
  { id: 2, sender: 'user', text: 'Yes, absolutely! I am just finalizing the warm minimalist tokens.' },
  { id: 3, sender: 'contact', text: 'Awesome. Let me know when you push the updates.' }
];
```[cite: 1]
