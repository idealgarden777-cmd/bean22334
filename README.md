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

## API (10 serverless functions)

| Route | Does |
|---|---|
| `POST /api/auth` | `login`, `register`, `check` (username available) |
| `GET/POST /api/me` | session + settings · `logout` · `update` (displayName, password, messageTimer, wallpaper) |
| `GET /api/users?q=` | find Bean IDs |
| `GET/POST /api/conversations` | list · `open_dm`, `create_group`, `rename`, `add_members`, `remove_member`, `leave`, `mute`, `read` |
| `GET/POST /api/messages` | history (`before` cursor) · `send`, `edit`, `delete`, `react` |
| `GET/POST /api/sync` | poll every 2.5 s: new/changed messages, typing, seen, chat list, incoming call · POST typing |
| `POST /api/upload` | signed upload URL into `bean-media` |
| `GET/POST /api/calls` | ICE config, signal polling · `start`, `accept`, `decline`, `end`, `signal` (encrypted only) |
| `GET/POST /api/keys` | public keys, encrypted Chat Lock backup, wrapped chat keys · `publish`, `backup`, `rekey` |
| `POST /api/neyo` | Neyo reply (Neyo chat only) · `tick` (reminders, digest, Away Mode auto-off) |

## Notes

- Real-time is HTTP polling (works on Vercel without extra services). Supabase Realtime can replace it later.
- Calls use Google STUN; add a TURN server (e.g. Metered, Twilio, Cloudflare) for networks that block peer-to-peer.
- Group calls and message search inside a chat are not built yet. (Search inside encrypted chats would have to run on the device.)
- Expired disappearing messages are hidden immediately; to delete them from the database too, schedule the cleanup line at the end of `bean_chat.sql` (pg_cron).

## v2.0: true end-to-end encryption 🔒

Every chat between people is end-to-end encrypted by default: DMs, groups, text, edits, reactions, photos, files, voice notes and call setup. The server stores only ciphertext. Plain text is refused by the API, so an old or modified client can't downgrade a chat.

| Piece | How |
|---|---|
| Identity key | ECDH P-256, one per Bean ID, same on all your devices |
| Chat Lock | your passphrase → Argon2id (64 MB, 3 passes) → AES-256-GCM seals the private key. Never leaves the browser. Forget it = old chats are gone (no backdoor) |
| Device | unlocked key kept in IndexedDB as a non-extractable CryptoKey; wiped on Sign out |
| Chat keys | random AES-256 key per chat "epoch", wrapped for each member with ECDH + HKDF. New epoch automatically when a member joins/leaves or changes key |
| Messages | AES-256-GCM; AAD binds chat + sender + epoch (no tampering, no re-labelling) |
| Media | a fresh AES-256-GCM key per file, uploaded as `encrypted.bin` (server can't see name or type) |
| Calls | WebRTC (DTLS-SRTP); the offer/answer/ICE are encrypted with the chat key, so the server can't swap the call fingerprint |
| Trust | 60-digit **safety number** per contact, "Verified" mark, **key-change warning** (sending is paused until you tap "Theek hai"), keys pinned per device |

**Not end-to-end encrypted, and labelled in the app:** the Neyo chat (an AI must read it; sent to Google Gemini), messages from before v2.0 (**"Not encrypted"** tag), the Away note, group names, profile, and metadata (who talks to whom, when, sizes).

**Security hardening:** rate limits (login per IP + per Bean ID, sign-up, messages, uploads, search, Neyo), same-origin check on every POST, equal-time login answers, reserved Bean IDs, password change needs the current password and signs out other devices, device list + "Log out all devices", strict CSP / HSTS / no framing / no referrer, fonts self-hosted, no third-party scripts, Gemini key sent in a header.

**Neyo (fast + stable):** answers only in its own chat, exactly once per message, overall deadline under Vercel's limit, quick retry on 429/5xx, broken models skipped for 30 min, last good model tried first. It can't read people's chats (encrypted), so chat-watching was removed; the daily digest is "who + how many".

**Ghost = Away Mode 👻:** contacts see "Away" + your short note (a status, not encrypted; the app says so and asks for a "Samajh gaya, Ghost on karo" tick). Ghost never reads or answers messages. When you're back, Neyo sends a handoff report: who wrote and how many messages.

**Security page:** `/security` (plain-language explanation) and `/.well-known/security.txt`.

### Upgrade to v2.0 (once)

1. Push this code to the GitHub repo (Vercel redeploys).
2. Supabase → SQL Editor → run `supabase/bean_e2ee.sql` (after `bean_chat.sql`, `bean_fix_old_tables.sql`, `bean_neyo.sql`).
3. Everyone opens Bean once and creates a **Chat Lock**. A message to someone who hasn't done this yet waits with a clear note.
4. Optional for trust: make the GitHub repo public (it holds no secrets) and put a real inbox behind `security@signaturesi.com` or change it in `public/.well-known/security.txt`.

### Honest limits

Bean is a web app: users trust the JavaScript the site serves (CSP, no third-party code and the build number in Settings reduce this risk). Malware on a device or screenshots can still expose messages. No independent security audit has been done yet.
