# Bean

Warm, minimal 1:1 chat for the Signaturesi ecosystem. Users sign in with the same **Bean ID** used by Neyo (`accounts.signaturesi.com`).

## Pages

| URL | What |
|---|---|
| `/` | **Bean Portal**: Bean ID greeting, sign in / create Bean ID, app cards (Messenger, Beanbox, Neyo, Bean ID) |
| `/chat` | **Bean Messenger** |

Built as a Vite multi-page app (`index.html`, `chat/index.html`, see `vite.config.js`).

## How login works

1. User signs in at `accounts.signaturesi.com`.
2. That sets the `bean_session` cookie on `.signaturesi.com`.
3. Bean (on `bean.signaturesi.com`) reads that cookie in its own `/api` functions and checks it against `bean_sessions` / `bean_users` in the same Supabase project.

## Setup

1. Supabase → SQL editor → run `supabase/bean_chat.sql` (creates `bean_conversations`, `bean_conversation_members`, `bean_messages`).
2. Vercel → import this repo → add env vars from `.env.example` (same values as accounts.signaturesi).
3. Add the domain `bean.signaturesi.com` to the Vercel project. It must be a `signaturesi.com` subdomain or the cookie won't be sent.

## Local dev

```
npm install
npm run dev
```

Vite has no `/api`, so local dev runs in **Demo** mode with sample chats saved in localStorage. Use `vercel dev` to run the real API locally.

## API

| Route | Method | What |
|---|---|---|
| `/api/me` | GET | Current Bean ID |
| `/api/logout` | POST | Revoke session, clear cookie |
| `/api/users?q=` | GET | Find Bean IDs |
| `/api/conversations` | GET / POST `{username}` | List chats / open a 1:1 chat |
| `/api/messages?conversationId=&after=` | GET | Messages (incremental) |
| `/api/messages` | POST `{conversationId,text}` | Send |

Messages refresh every 3 seconds while the tab is open.

## Next

- Supabase Realtime instead of polling
- Attachments (Storage `uploads` bucket, like Neyo)
- Unread counts, typing indicator, voice/video
