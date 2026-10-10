# Bean

The Signaturesi communication app. One **Bean ID** (same as Neyo, from `accounts.signaturesi.com`) for chats, groups, voice notes and calls.

## v3.0 (simple, no end-to-end encryption)

Bean works like before: log in and chat. Messages are protected in transit (HTTPS) and stored in Supabase (encrypted at rest by Supabase), but they are **not end-to-end encrypted**, so don't market it as E2EE.

Hardening kept from v2: same-origin check on every POST, rate limits (login per IP and per Bean ID, sign up, messages, uploads, search, Neyo), equal-time failed logins, reserved Bean IDs, password change needs the current password and signs out other devices, device list + **Log out all devices**, CSP/HSTS/no-framing headers, self-hosted fonts (no third-party scripts). Neyo: Gemini key in a header, overall deadline, quick retry, model fallback, exactly one answer per message. Ghost: AI replies for you while away, 👻 labelled, once per message.

Database: no new SQL. Uses `bean_rate_limits`/`bean_rate_hit` and `bean_neyo_jobs` from `bean_e2ee.sql` (already run); the E2EE key tables simply stay unused. Messages sent by the short-lived v2 show "🔒 purane encrypted version" instead of a blank bubble.

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

## Bean Meet (v3.5)

- Start a meeting from any group chat header, or from the Meet button in the sidebar (instant meeting with a link).
- Link: `https://bean.signaturesi.com/meet/abc-defg-hij`. Needs a Bean login; people outside the chat wait in a lobby until someone inside admits them (they see the Bean ID first). Host can lock, remove, end for everyone.
- Up to 8 people (mesh WebRTC, signalling by polling `/api/meet`). Several people can share their screen at the same time.
- Captions & transcript: each browser turns its own speech into text (Chrome, Edge, Safari); everyone sees "Transcript on". When the meeting ends Neyo writes notes into the chat (instant meetings: into each person's Neyo chat).
- 1:1 voice and video calls also have screen sharing.
- Links in chats: Bean meeting links open inside Bean; any other link asks first and warns about Bean look-alike sites.
- Database: run `supabase/bean_update_v35.sql` once (project ajglvfoqiyrrisuoxecu). `GET /api/me?health=1` shows `meetings: "ok"` after.
- Optional: set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` for people on very strict networks.

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

## Neyo + Neyo Ghost 👻

- **Neyo** (`neyo@bean`): AI contact pinned on Home. Answers in his DM, and in groups only when someone writes `@neyo`. Can set reminders, watch a chat, send a daily digest.
- **Neyo Ghost = Delegated Presence**: Settings → Neyo Ghost (or tell Neyo "main 2 ghante busy hun, ghost on karo").
  - While on, Ghost answers simple **direct** messages in your name, every reply marked **👻 Ghost**.
  - Money, plans, promises, private things: polite holding reply, queued for you. Urgent messages: Neyo pings you.
  - Others see "👻 Away · Ghost replies for them" in your chat header. Groups are never answered.
  - "I'm back" (sidebar banner) or the timer ending → **handoff report** in your Neyo chat.
- Setup: run `supabase/bean_neyo.sql`, add `GEMINI_API_KEY` in Vercel, redeploy.
- Ghost runs on each send (`/api/neyo` action `ghost`) plus every minute while anyone has Bean open (`/api/neyo?action=tick`). For 24/7, enable pg_cron + pg_net (see end of `bean_neyo.sql`).
