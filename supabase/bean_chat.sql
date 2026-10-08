-- =========================================================
-- Bean chat tables
-- Run once in the Supabase SQL editor of the SAME project
-- used by accounts.signaturesi.com (bean_users already exists).
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists public.bean_conversations (
  id             uuid primary key default gen_random_uuid(),
  dm_key         text unique not null,
  last_message   text,
  last_sender_id uuid references public.bean_users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.bean_conversation_members (
  conversation_id uuid not null references public.bean_conversations(id) on delete cascade,
  user_id         uuid not null references public.bean_users(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.bean_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bean_conversations(id) on delete cascade,
  sender_id       uuid not null references public.bean_users(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now()
);

create index if not exists bean_members_user_idx on public.bean_conversation_members (user_id);
create index if not exists bean_messages_conv_time_idx on public.bean_messages (conversation_id, created_at);

-- Only the server (service role key) touches these tables.
alter table public.bean_conversations        enable row level security;
alter table public.bean_conversation_members enable row level security;
alter table public.bean_messages             enable row level security;
