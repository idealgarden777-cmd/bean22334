/* Demo data for local `npm run dev` (Vite has no /api). Saved in localStorage. */
const KEY = "bean_demo_v1";
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

function seed() {
  return {
    me: { id: "me", username: "you", displayName: "You", beanId: "you@bean" },
    conversations: [
      {
        id: "c1",
        updatedAt: minutesAgo(3),
        lastMessage: "Hello! How are you doing?",
        lastSenderId: "me",
        contact: { id: "u1", username: "ayesha", displayName: "Ayesha Khan", beanId: "ayesha@bean" },
      },
      {
        id: "c2",
        updatedAt: minutesAgo(140),
        lastMessage: "Hey, are we still meeting?",
        lastSenderId: "u2",
        contact: { id: "u2", username: "zain", displayName: "Zain Ahmed", beanId: "zain@bean" },
      },
    ],
    messages: {
      c1: [
        { id: "m1", senderId: "u1", text: "Hi", createdAt: minutesAgo(4) },
        { id: "m2", senderId: "me", text: "Hello! How are you doing?", createdAt: minutesAgo(3) },
      ],
      c2: [{ id: "m3", senderId: "u2", text: "Hey, are we still meeting?", createdAt: minutesAgo(140) }],
    },
  };
}

export function loadDemo() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.me) return saved;
  } catch {}
  return seed();
}

export function saveDemo(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}
