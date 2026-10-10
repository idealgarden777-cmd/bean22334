-- Bean 3.5: Bean Meet (group video meetings, screen sharing, captions + transcript, Neyo notes)
-- Run in Supabase project ajglvfoqiyrrisuoxecu (Bean), SQL Editor. Safe to run twice.

create table if not exists public.bean_meetings (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  conversation_id uuid references public.bean_conversations(id) on delete set null,
  host_id         uuid not null references public.bean_users(id) on delete cascade,
  title           text,
  status          text not null default 'live' check (status in ('live', 'ended')),
  transcribing    boolean not null default false,
  locked          boolean not null default false,
  message_id      uuid,
  notes           text,
  created_at      timestamptz not null default now(),
  ended_at        timestamptz
);

create table if not exists public.bean_meeting_peers (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.bean_meetings(id) on delete cascade,
  user_id      uuid not null references public.bean_users(id) on delete cascade,
  status       text not null default 'waiting' check (status in ('waiting', 'joined', 'left', 'denied', 'removed')),
  hand         boolean not null default false,
  muted        boolean not null default false,
  camera_off   boolean not null default false,
  sharing      boolean not null default false,
  created_at   timestamptz not null default now(),
  joined_at    timestamptz,
  last_seen_at timestamptz not null default now(),
  left_at      timestamptz
);

create table if not exists public.bean_meeting_signals (
  id         bigserial primary key,
  meeting_id uuid not null references public.bean_meetings(id) on delete cascade,
  from_peer  uuid not null,
  to_peer    uuid not null,
  type       text not null check (type in ('offer', 'answer', 'ice')),
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bean_meeting_captions (
  id         bigserial primary key,
  meeting_id uuid not null references public.bean_meetings(id) on delete cascade,
  user_id    uuid references public.bean_users(id) on delete set null,
  text       text not null,
  created_at timestamptz not null default now()
);

create index if not exists bean_meetings_conv_idx    on public.bean_meetings (conversation_id, status);
create index if not exists bean_meet_peers_idx       on public.bean_meeting_peers (meeting_id, status);
create index if not exists bean_meet_peers_user_idx  on public.bean_meeting_peers (user_id);
create index if not exists bean_meet_signals_idx     on public.bean_meeting_signals (meeting_id, to_peer, id);
create index if not exists bean_meet_captions_idx    on public.bean_meeting_captions (meeting_id, id);

-- locked down like every other Bean table: only the server (service role) can touch them
alter table public.bean_meetings          enable row level security;
alter table public.bean_meeting_peers     enable row level security;
alter table public.bean_meeting_signals   enable row level security;
alter table public.bean_meeting_captions  enable row level security;
revoke all on table public.bean_meetings, public.bean_meeting_peers, public.bean_meeting_signals, public.bean_meeting_captions from anon, authenticated;
revoke all on sequence public.bean_meeting_signals_id_seq, public.bean_meeting_captions_id_seq from anon, authenticated;
