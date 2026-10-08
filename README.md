# Bean

The Signaturesi communication app. One **Bean ID** (same as Neyo, from `accounts.signaturesi.com`) for chats, groups, voice notes and calls.

## Pages

| URL | What |
|---|---|
| `/` | Bean login (original layout): Username or @bean ID, Password, **Enter Workspace**, Sign Up. Already signed in → straight to `/chat` |
| `/chat` | Bean Messenger. Signed out → back to `/` |

## Features

**From the original Bean**
- Sidebar: my avatar + Bean ID, ⚙️ Settings, ⏻ Sign out, Search users…, **New Message**, **Home / Beanbox** (Beanbox = chats with unread messages)
- Composer with **0/2000** character counter, **emoji picker with search**
- Message actions: Reply, Edit Message, Add Reaction (❤️ 😂 😮 😢 👍 🔥), **Unsend Message** with **Undo** (5 s)
- **Settings**: Display Name, New Password, **Update Identity**, **Default Message Timer** (Off / 24 Hours / 7 Days / 30 Days → disappearing messages + banner), **Chat Wallpaper**, dark mode, notifications

**Added**

- **Direct chats + groups** (create, rename, add/remove members, admins, leave)
- **Messages**: text with links, emoji-only big emoji, reply, edit, delete for everyone, copy
- **Reactions** ❤️ 😂 😮 😢 👍 🔥 (double-click a bubble for ❤️, long-press on phones)
- **Media**: photos (lightbox), files up to 25 MB, drag & drop, paste images, **voice notes**
- **Live status**: typing…, delivered ✓✓ / seen (blue), unread badges, online / last seen
- **Notifications**: sound, browser notifications, `(3) Bean` tab badge, mute per chat
- **Voice & video calls** (1:1, WebRTC): ringing, accept/decline, mute, camera, call log in chat
- Search chats, deep links (`/chat#<conversationId>`), load older messages, dark mode, mobile layout

## How login works

1. User signs in on Bean's own login screen (`/api/auth`) — same tables and rules as accounts.signaturesi.com: `bean_users`, `bean_credentials` (argon2id), `bean_sessions`, password ≥ 10 characters.
2. Bean sets the `bean_session` cookie on `.signaturesi.com`, so the same login works on Neyo and accounts (and vice versa).
3. On other hosts (e.g. `*.vercel.app` previews) the cookie is host-only, so testing works there too.

## Setup (once)

1. **Supabase** (same project as accounts/Neyo) → SQL Editor → run `supabase/bean_chat.sql`.
   Creates the chat tables, `bean_settings`, `expires_at` for disappearing messages, the `bean_unread_counts` function and the private `bean-media` storage bucket.
2. **Vercel** → import this repo → Environment Variables:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_COOKIE_NAME=bean_session` (same values as accounts.signaturesi)
   - optional, for calls on strict mobile/office networks: `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`
3. **Domain**: move `bean.signaturesi.com` to this Vercel project (needed for the shared login with Neyo).

## Local dev

```
npm install
npm run dev        # demo mode: any username/password signs in, sample chats in localStorage
vercel dev         # real API locally
```

## API (8 serverless functions)

| Route | Does |
|---|---|
| `POST /api/auth` | `login`, `register`, `check` (username available) |
| `GET/POST /api/me` | session + settings · `logout` · `update` (displayName, password, messageTimer, wallpaper) |
| `GET /api/users?q=` | find Bean IDs |
| `GET/POST /api/conversations` | list · `open_dm`, `create_group`, `rename`, `add_members`, `remove_member`, `leave`, `mute`, `read` |
| `GET/POST /api/messages` | history (`before` cursor) · `send`, `edit`, `delete`, `react` |
| `GET/POST /api/sync` | poll every 2.5 s: new/changed messages, typing, seen, chat list, incoming call · POST typing |
| `POST /api/upload` | signed upload URL into `bean-media` |
| `GET/POST /api/calls` | ICE config, signal polling · `start`, `accept`, `decline`, `end`, `signal` |

## Notes

- Real-time is HTTP polling (works on Vercel without extra services). Supabase Realtime can replace it later.
- Calls use Google STUN; add a TURN server (e.g. Metered, Twilio, Cloudflare) for networks that block peer-to-peer.
- Group calls, message search inside a chat, and end-to-end encryption are not built yet (the old Bean's "E2EE" label is not used).
- Expired disappearing messages are hidden immediately; to delete them from the database too, schedule the cleanup line at the end of `bean_chat.sql` (pg_cron).
