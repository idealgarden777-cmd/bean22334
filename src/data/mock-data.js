/* =================================================================
   Mock Data for Chat Application
   ================================================================ */

export const initialData = {
  currentUser: {
    id: "u_me",
    name: "Yash",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    status: "online"
  },
  contacts: [
    {
      id: "c_1",
      name: "Samuel Yusuf",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      status: "Online",
      unreadCount: 2,
      lastSeen: "Just now",
      isPinned: true
    },
    {
      id: "c_2",
      name: "Srishna Yusuf",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      status: "Active 2h ago",
      unreadCount: 0,
      lastSeen: "2h ago",
      isPinned: false
    },
    {
      id: "c_3",
      name: "Ideal Garden Team",
      avatar: "https://images.unsplash.com/photo-1558904541-efa843a88f01?w=150&auto=format&fit=crop&q=80",
      status: "Landscape Studio",
      unreadCount: 0,
      lastSeen: "Yesterday",
      isPinned: true
    }
  ],
  messages: {
    "c_1": [
      {
        id: "m_1",
        senderId: "c_1",
        text: "Hey Yash, check out the new hardscaping layout designs for the head office project.",
        timestamp: "10:42 AM",
        status: "read"
      },
      {
        id: "m_2",
        senderId: "u_me",
        text: "Just reviewed them! The spacing grid and layout structure look solid.",
        timestamp: "10:45 AM",
        status: "read"
      }
    ],
    "c_2": [
      {
        id: "m_3",
        senderId: "c_2",
        text: "Are we launching the updated web component repository today?",
        timestamp: "Yesterday",
        status: "read"
      }
    ],
    "c_3": [
      {
        id: "m_4",
        senderId: "c_3",
        text: "Client catalog quotations updated with new plant inventory specs.",
        timestamp: "Monday",
        status: "read"
      }
    ]
  }
};
