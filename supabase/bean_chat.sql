-- =========================================================
-- BEAN — communication app schema
-- Run in the Supabase SQL editor of the SAME project used by
-- accounts.signaturesi.com (bean_users already exists).
-- Safe to run more than once.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- conversations (direct + group) ----------
create table if not exists public.bean_conversations (
  id              uuid primary key default gen_random_uuid(),
  type            text not null default 'dm' check (type in ('dm', 'group')),
  dm_key          text unique,
  title           text,
  created_by      uuid references public.bean_users(id) on delete set null,
  last_message    text,
  last_sender_id  uuid references public.bean_users(id) on delete set null,
  last_message_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- (old Bean tables may already exist with fewer columns: add whatever is missing)
alter table public.bean_conversations add column if not exists type text not null default 'dm';
alter table public.bean_conversations add column if not exists dm_key text;
alter table public.bean_conversations add column if not exists title text;
alter table public.bean_conversations add column if not exists created_by uuid references public.bean_users(id) on delete set null;
alter table public.bean_conversations add column if not exists last_message text;
alter table public.bean_conversations add column if not exists last_sender_id uuid references public.bean_users(id) on delete set null;
alter table public.bean_conversations add column if not exists last_message_id uuid;
alter table public.bean_conversations add column if not exists created_at timestamptz not null default now();
alter table public.bean_conversations add column if not exists updated_at timestamptz not null default now();
alter table public.bean_conversations alter column dm_key drop not null;
create unique index if not exists bean_conversations_dm_key_idx on public.bean_conversations (dm_key);

create table if not exists public.bean_conversation_members (
  conversation_id uuid not null references public.bean_conversations(id) on delete cascade,
  user_id         uuid not null references public.bean_users(id) on delete cascade,
  role            text not null default 'member' check (role in ('admin', 'member')),
  last_read_at    timestamptz not null default now(),
  muted           boolean not null default false,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.bean_conversation_members add column if not exists role text not null default 'member';
alter table public.bean_conversation_members add column if not exists joined_at timestamptz not null default now();
alter table public.bean_conversation_members add column if not exists last_read_at timestamptz not null default now();
alter table public.bean_conversation_members add column if not exists muted boolean not null default false;

-- ---------- messages ----------
create table if not exists public.bean_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bean_conversations(id) on delete cascade,
  sender_id       uuid references public.bean_users(id) on delete set null,
  kind            text not null default 'text' check (kind in ('text', 'image', 'file', 'audio', 'call', 'system')),
  body            text check (body is null or char_length(body) <= 4000),
  attachment      jsonb,
  reply_to        uuid references public.bean_messages(id) on delete set null,
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.bean_messages add column if not exists sender_id uuid references public.bean_users(id) on delete set null;
alter table public.bean_messages add column if not exists kind text not null default 'text';
alter table public.bean_messages add column if not exists body text;
alter table public.bean_messages add column if not exists created_at timestamptz not null default now();
alter table public.bean_messages add column if not exists attachment jsonb;
alter table public.bean_messages add column if not exists reply_to uuid references public.bean_messages(id) on delete set null;
alter table public.bean_messages add column if not exists edited_at timestamptz;
alter table public.bean_messages add column if not exists deleted_at timestamptz;
alter table public.bean_messages add column if not exists updated_at timestamptz not null default now();
alter table public.bean_messages add column if not exists expires_at timestamptz;
alter table public.bean_messages alter column body drop not null;
alter table public.bean_messages alter column sender_id drop not null;
alter table public.bean_messages drop constraint if exists bean_messages_body_check;

create table if not exists public.bean_reactions (
  message_id uuid not null references public.bean_messages(id) on delete cascade,
  user_id    uuid not null references public.bean_users(id) on delete cascade,
  emoji      text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- ---------- per-user settings (message timer, wallpaper) ----------
create table if not exists public.bean_settings (
  user_id       uuid primary key references public.bean_users(id) on delete cascade,
  message_timer integer not null default 0 check (message_timer in (0, 86400, 604800, 2592000)),
  wallpaper     text not null default 'none',
  updated_at    timestamptz not null default now()
);

alter table public.bean_reactions add column if not exists emoji text;
alter table public.bean_reactions add column if not exists created_at timestamptz not null default now();
alter table public.bean_settings add column if not exists message_timer integer not null default 0;
alter table public.bean_settings add column if not exists wallpaper text not null default 'none';
alter table public.bean_settings add column if not exists updated_at timestamptz not null default now();

-- ---------- presence + typing ----------
create table if not exists public.bean_presence (
  user_id      uuid primary key references public.bean_users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  typing_in    uuid,
  typing_at    timestamptz
);

alter table public.bean_presence add column if not exists last_seen_at timestamptz not null default now();
alter table public.bean_presence add column if not exists typing_in uuid;
alter table public.bean_presence add column if not exists typing_at timestamptz;

-- ---------- calls (WebRTC signalling) ----------
create table if not exists public.bean_calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bean_conversations(id) on delete cascade,
  caller_id       uuid not null references public.bean_users(id) on delete cascade,
  callee_id       uuid not null references public.bean_users(id) on delete cascade,
  kind            text not null default 'audio' check (kind in ('audio', 'video')),
  status          text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'declined', 'missed')),
  created_at      timestamptz not null default now(),
  answered_at     timestamptz,
  ended_at        timestamptz
);

create table if not exists public.bean_call_signals (
  id         bigserial primary key,
  call_id    uuid not null references public.bean_calls(id) on delete cascade,
  from_user  uuid not null references public.bean_users(id) on delete cascade,
  to_user    uuid not null references public.bean_users(id) on delete cascade,
  type       text not null check (type in ('offer', 'answer', 'ice')),
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists bean_members_user_idx        on public.bean_conversation_members (user_id);
create index if not exists bean_messages_conv_time_idx  on public.bean_messages (conversation_id, created_at);
create index if not exists bean_messages_conv_upd_idx   on public.bean_messages (conversation_id, updated_at);
create index if not exists bean_reactions_msg_idx       on public.bean_reactions (message_id);
create index if not exists bean_calls_callee_idx        on public.bean_calls (callee_id, status);
create index if not exists bean_signals_call_idx        on public.bean_call_signals (call_id, to_user, id);

-- ---------- unread counts ----------
create or replace function public.bean_unread_counts(p_user uuid)
returns table (conversation_id uuid, unread bigint)
language sql stable as $$
  select m.conversation_id, count(msg.id)
  from public.bean_conversation_members m
  join public.bean_messages msg
    on msg.conversation_id = m.conversation_id
   and msg.created_at > m.last_read_at
   and msg.sender_id <> p_user
   and msg.deleted_at is null
   and msg.kind <> 'system'
   and (msg.expires_at is null or msg.expires_at > now())
  where m.user_id = p_user
  group by m.conversation_id;
$$;

-- ---------- storage for photos, files, voice notes ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('bean-media', 'bean-media', false, 26214400)
on conflict (id) do nothing;

-- ---------- lock down: only the server (service role) reads/writes ----------
alter table public.bean_conversations        enable row level security;
alter table public.bean_conversation_members enable row level security;
alter table public.bean_messages             enable row level security;
alter table public.bean_reactions            enable row level security;
alter table public.bean_presence             enable row level security;
alter table public.bean_calls                enable row level security;
alter table public.bean_call_signals         enable row level security;
alter table public.bean_settings             enable row level security;

-- ---------- clean up expired (disappearing) messages, optional: run daily with pg_cron ----------
-- delete from public.bean_messages where expires_at is not null and expires_at < now();
