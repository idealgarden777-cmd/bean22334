# Bean

The Signaturesi communication app. One **Bean ID** (same as Neyo, from `accounts.signaturesi.com`) for chats, groups, voice notes and calls.

## Pages

| URL | What |
|---|---|
| `/` | Bean Portal: sign in, apps (Messenger, Beanbox, Neyo, Bean ID) |
| `/chat` | Bean Messenger |

## Features

- **Direct chats + groups** (create, rename, add/remove members, admins, leave)
- **Messages**: text with links, emoji-only big emoji, reply, edit, delete for everyone, copy
- **Reactions** ❤️ 😂 😮 😢 👍 🔥 (double-click a bubble for ❤️, long-press on phones)
- **Media**: photos (lightbox), files up to 25 MB, drag & drop, paste images, **voice notes**
- **Live status**: typing…, delivered ✓✓ / seen (blue), unread badges, online / last seen
- **Notifications**: sound, browser notifications, `(3) Bean` tab badge, mute per chat
- **Voice & video calls** (1:1, WebRTC): ringing, accept/decline, mute, camera, call log in chat
- Search chats, deep links (`/chat#<conversationId>`), load older messages, dark mode, mobile layout

## How login works

1. User signs in at `accounts.signaturesi.com` → `bean_session` cookie on `.signaturesi.com`.
2. Bean's `/api/*` functions read that cookie and check `bean_sessions` / `bean_users` in the same Supabase project.

## Setup (once)

1. **Supabase** (same project as accounts/Neyo) → SQL Editor → run `supabase/bean_chat.sql`.
   Creates the chat tables, the `bean_unread_counts` function and the private `bean-media` storage bucket.
2. **Vercel** → import this repo → Environment Variables:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_COOKIE_NAME=bean_session` (same values as accounts.signaturesi)
   - optional, for calls on strict mobile/office networks: `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`
3. **Domain**: `bean.signaturesi.com` on this Vercel project (must be a signaturesi.com subdomain for the cookie).

## Local dev

```
npm install
npm run dev        # demo mode: sample chats in localStorage, no backend
vercel dev         # real API locally
```

## API (7 serverless functions)

| Route | Does |
|---|---|
| `GET/POST /api/me` | session · `{action:"logout"}` |
| `GET /api/users?q=` | find Bean IDs |
| `GET/POST /api/conversations` | list · `open_dm`, `create_group`, `rename`, `add_members`, `remove_member`, `leave`, `mute`, `read` |
| `GET/POST /api/messages` | history (`before` cursor) · `send`, `edit`, `delete`, `react` |
| `GET/POST /api/sync` | poll every 2.5 s: new/changed messages, typing, seen, chat list, incoming call · POST typing |
| `POST /api/upload` | signed upload URL into `bean-media` |
| `GET/POST /api/calls` | ICE config, signal polling · `start`, `accept`, `decline`, `end`, `signal` |

## Notes

- Real-time is HTTP polling (works on Vercel without extra services). Supabase Realtime can replace it later.
- Calls use Google STUN; add a TURN server (e.g. Metered, Twilio, Cloudflare) for networks that block peer-to-peer.
- Group calls, message search inside a chat, and end-to-end encryption are not built yet.
