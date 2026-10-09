-- =========================================================
-- Bean v2.0: end-to-end encryption + security hardening
-- Run AFTER bean_chat.sql, bean_fix_old_tables.sql, bean_neyo.sql.
-- Safe to run more than once.
-- =========================================================

-- ---------- public keys (+ private key backup encrypted with the user's Chat Lock) ----------
create table if not exists public.bean_keys (
  user_id     uuid primary key references public.bean_users(id) on delete cascade,
  public_key  jsonb not null,             -- ECDH P-256 public key (JWK x/y)
  fingerprint text  not null,             -- sha-256 hex, checked again in every browser
  backup      jsonb not null,             -- private key, AES-GCM with Argon2id(Chat Lock). Server can't open it.
  key_version integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- chat keys, wrapped for each member (one row per member per key epoch) ----------
create table if not exists public.bean_chat_keys (
  id              bigserial primary key,
  conversation_id uuid not null references public.bean_conversations(id) on delete cascade,
  epoch           integer not null,
  user_id         uuid not null references public.bean_users(id) on delete cascade,  -- recipient
  sender_id       uuid not null references public.bean_users(id) on delete cascade,
  sender_pub      jsonb not null,
  recipient_fp    text not null,
  wrapped         jsonb not null,
  created_at      timestamptz not null default now(),
  unique (conversation_id, epoch, user_id)
);
create index if not exists bean_chat_keys_user_idx on public.bean_chat_keys (user_id, created_at desc);
create index if not exists bean_chat_keys_conv_idx on public.bean_chat_keys (conversation_id, epoch desc);

-- ---------- ciphertext columns ----------
alter table public.bean_messages  add column if not exists enc jsonb;   -- {v, e, iv, ct}; body stays null
alter table public.bean_reactions add column if not exists enc jsonb;   -- encrypted emoji

-- ---------- rate limits (login, sign up, messages, uploads, Neyo) ----------
create table if not exists public.bean_rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

create or replace function public.bean_rate_hit(p_key text, p_window integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_hits integer;
begin
  insert into public.bean_rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;
revoke all on function public.bean_rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.bean_rate_hit(text, integer, integer) to service_role;

-- ---------- Neyo: exactly one answer per message ----------
create table if not exists public.bean_neyo_jobs (
  message_id uuid primary key,
  created_at timestamptz not null default now()
);

-- ---------- sessions: fast lookups for "Log out all devices" ----------
create index if not exists bean_sessions_user_idx on public.bean_sessions (user_id, revoked_at);

-- ---------- lock down: only the server (service role) can touch these ----------
alter table public.bean_keys        enable row level security;
alter table public.bean_chat_keys   enable row level security;
alter table public.bean_rate_limits enable row level security;
alter table public.bean_neyo_jobs   enable row level security;

-- ---------- Ghost (Away Mode) no longer reads chats: clear old AI text from the log ----------
do $$ begin
  if to_regclass('public.bean_ghost_log') is not null then
    update public.bean_ghost_log set incoming = null, summary = null, ghost_reply = null
     where incoming is not null or summary is not null or ghost_reply is not null;
  end if;
end $$;

-- ---------- OPTIONAL housekeeping (pg_cron), run once if you use pg_cron ----------
-- select cron.schedule('bean-cleanup', '17 3 * * *', $$
--   delete from public.bean_rate_limits where window_start < now() - interval '1 day';
--   delete from public.bean_neyo_jobs   where created_at   < now() - interval '7 days';
--   delete from public.bean_messages    where expires_at is not null and expires_at < now();
-- $$);
