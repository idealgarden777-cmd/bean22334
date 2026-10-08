-- =========================================================
-- Neyo + Neyo Ghost inside Bean. Run after bean_chat.sql
-- and bean_fix_old_tables.sql. Safe to run twice.
-- =========================================================

-- Neyo's own Bean ID (no password: nobody can log in as Neyo)
insert into public.bean_users (id, username, display_name, status)
values ('0e000000-0000-4000-8000-000000000001', 'neyo', 'Neyo', 'active')
on conflict do nothing;

-- Ghost tasks: reminders, chat watching, daily digests
create table if not exists public.bean_ghost_tasks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.bean_users(id) on delete cascade,
  kind                  text not null check (kind in ('remind', 'watch', 'digest')),
  title                 text not null,
  prompt                text,
  run_at                timestamptz,
  repeat_seconds        integer,
  watch_conversation_id uuid references public.bean_conversations(id) on delete cascade,
  until_at              timestamptz,
  last_checked_at       timestamptz,
  status                text not null default 'active' check (status in ('active', 'done', 'cancelled')),
  created_at            timestamptz not null default now()
);
create index if not exists bean_ghost_due_idx on public.bean_ghost_tasks (status, run_at);
create index if not exists bean_ghost_user_idx on public.bean_ghost_tasks (user_id, status);
alter table public.bean_ghost_tasks enable row level security;

-- one row lock so only one Ghost run works at a time
create table if not exists public.bean_ghost_state (
  id           integer primary key,
  last_tick_at timestamptz not null default 'epoch'
);
insert into public.bean_ghost_state (id) values (1) on conflict do nothing;
alter table public.bean_ghost_state enable row level security;

-- ---------------------------------------------------------
-- Neyo Ghost = Delegated Presence (Ghost Mode)
-- ---------------------------------------------------------
alter table public.bean_settings add column if not exists ghost_enabled boolean not null default false;
alter table public.bean_settings add column if not exists ghost_note    text;
alter table public.bean_settings add column if not exists ghost_since   timestamptz;
alter table public.bean_settings add column if not exists ghost_until   timestamptz;

-- messages Ghost sent on someone's behalf show a "👻 Ghost" label
alter table public.bean_messages add column if not exists ghost boolean not null default false;

-- every message Ghost handled, for the handoff report
create table if not exists public.bean_ghost_log (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.bean_users(id) on delete cascade,
  conversation_id uuid not null references public.bean_conversations(id) on delete cascade,
  from_user_id    uuid references public.bean_users(id) on delete set null,
  message_id      uuid not null unique,
  status          text not null default 'working',
  priority        text not null default 'normal',
  summary         text,
  incoming        text,
  ghost_reply     text,
  reported_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists bean_ghost_log_owner_idx on public.bean_ghost_log (owner_id, reported_at, created_at);
alter table public.bean_ghost_log enable row level security;

-- ---------------------------------------------------------
-- OPTIONAL (recommended): run Ghost every minute even when
-- nobody has Bean open. Needs pg_cron + pg_net
-- (Supabase -> Database -> Extensions -> enable both), then
-- run the two lines below once:
--
-- select cron.schedule('neyo-ghost', '* * * * *',
--   $$ select net.http_post(url := 'https://bean.signaturesi.com/api/neyo?action=tick',
--        headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb) $$);
-- ---------------------------------------------------------
