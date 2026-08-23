/* ============================================================
   BEAN — SIGNATURESI
   Production Supabase Schema

   Public identity:
     bean@username

   Permanent internal identity:
     UUID

   IMPORTANT AUTH CONTRACT
   ------------------------------------------------------------
   Signaturesi Accounts JWT must provide:

     sub  = permanent Signaturesi user UUID
     role = authenticated

   Bean intentionally does NOT foreign-key users to auth.users.

   This allows:
     Accounts / Neyo / Bean / future Signaturesi apps
   to share the same permanent UUID.

   LEGACY SAFETY
   ------------------------------------------------------------
   This schema does NOT alter or delete legacy tables such as:

     profiles
     messages
     direct_messages

   New production tables use the bean_* prefix.

   EXISTING STORAGE BUCKETS
   ------------------------------------------------------------
   Expected:
     bean-avatars  public   5 MiB
     bean-media    private  100 MiB

   Realtime Dashboard:
     "Allow public access" should be OFF.

   ============================================================ */


/* ============================================================
   EXTENSIONS
   ============================================================ */

create extension if not exists pgcrypto;


/* ============================================================
   PRIVATE HELPER SCHEMA
   Not exposed through Supabase Data API.
   ============================================================ */

create schema if not exists private;

revoke all
on schema private
from public;

grant usage
on schema private
to authenticated;


/* ============================================================
   UPDATED_AT HELPER
   ============================================================ */

create or replace function private.bean_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


/* ============================================================
   01. USER PROFILES

   UUID is the permanent Signaturesi identity.
   ============================================================ */

create table if not exists public.bean_user_profiles (
  id uuid primary key,

  display_name text not null
    check (
      char_length(display_name)
      between 1 and 80
    ),

  bio text not null default ''
    check (
      char_length(bio) <= 500
    ),

  avatar_path text,

  profile_type text not null
    default 'personal'
    check (
      profile_type in (
        'personal',
        'professional',
        'business',
        'creator'
      )
    ),

  city text
    check (
      city is null
      or char_length(city) <= 100
    ),

  country_code text
    check (
      country_code is null
      or country_code ~ '^[A-Z]{2}$'
    ),

  is_discoverable boolean
    not null default true,

  is_available_for_work boolean
    not null default false,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);


create index if not exists
  bean_user_profiles_discoverable_idx
on public.bean_user_profiles (
  is_discoverable
)
where is_discoverable = true;


create index if not exists
  bean_user_profiles_work_idx
on public.bean_user_profiles (
  is_available_for_work
)
where is_available_for_work = true;


drop trigger if exists
  bean_user_profiles_updated_at
on public.bean_user_profiles;

create trigger
  bean_user_profiles_updated_at
before update
on public.bean_user_profiles
for each row
execute function
  private.bean_set_updated_at();


/* ============================================================
   02. PUBLIC BEAN IDS

   Database stores:
     samuel

   UI displays:
     bean@samuel

   Handle is NOT used as relational identity.
   ============================================================ */

create table if not exists public.bean_user_handles (
  user_id uuid primary key
    references public.bean_user_profiles(id)
    on delete cascade,

  handle text not null unique
    check (
      char_length(handle)
      between 3 and 20
    )
    check (
      handle ~ '^[a-z0-9_]+$'
    ),

  created_at timestamptz
    not null default now()
);


create unique index if not exists
  bean_user_handles_lower_idx
on public.bean_user_handles (
  lower(handle)
);


/* ============================================================
   03. USER BLOCKS
   ============================================================ */

create table if not exists public.bean_user_blocks (
  blocker_id uuid not null
    references public.bean_user_profiles(id)
    on delete cascade,

  blocked_id uuid not null
    references public.bean_user_profiles(id)
    on delete cascade,

  created_at timestamptz
    not null default now(),

  primary key (
    blocker_id,
    blocked_id
  ),

  check (
    blocker_id <> blocked_id
  )
);


create index if not exists
  bean_user_blocks_blocked_idx
on public.bean_user_blocks (
  blocked_id
);


/* ============================================================
   04. CONVERSATIONS
   ============================================================ */

create table if not exists public.bean_conversations (
  id uuid primary key
    default gen_random_uuid(),

  kind text not null
    check (
      kind in (
        'direct',
        'group',
        'project'
      )
    ),

  created_by uuid
    references public.bean_user_profiles(id)
    on delete set null,

  title text
    check (
      title is null
      or char_length(title) <= 120
    ),

  avatar_path text,

  /*
   * Used only internally to guarantee one direct
   * conversation per pair of permanent UUIDs.
   *
   * Example:
   * <smaller UUID>:<larger UUID>
   */
  direct_key text unique,

  settings jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  check (
    (
      kind = 'direct'
      and direct_key is not null
    )
    or
    (
      kind <> 'direct'
      and direct_key is null
    )
  )
);


create index if not exists
  bean_conversations_updated_idx
on public.bean_conversations (
  updated_at desc
);


drop trigger if exists
  bean_conversations_updated_at
on public.bean_conversations;

create trigger
  bean_conversations_updated_at
before update
on public.bean_conversations
for each row
execute function
  private.bean_set_updated_at();


/* ============================================================
   05. CONVERSATION MEMBERS
   ============================================================ */

create table if not exists public.bean_conversation_members (
  conversation_id uuid not null
    references public.bean_conversations(id)
    on delete cascade,

  user_id uuid not null
    references public.bean_user_profiles(id)
    on delete cascade,

  role text not null
    default 'member'
    check (
      role in (
        'owner',
        'admin',
        'member'
      )
    ),

  joined_at timestamptz
    not null default now(),

  removed_at timestamptz,

  last_read_at timestamptz,

  muted_until timestamptz,

  primary key (
    conversation_id,
    user_id
  )
);


create index if not exists
  bean_conversation_members_user_idx
on public.bean_conversation_members (
  user_id,
  conversation_id
);


create index if not exists
  bean_conversation_members_active_idx
on public.bean_conversation_members (
  conversation_id,
  user_id
)
where removed_at is null;


/* ============================================================
   SECURITY HELPER:
   CONVERSATION MEMBERSHIP

   SECURITY DEFINER avoids recursive RLS checks.
   Every relation is schema-qualified.
   ============================================================ */

create or replace function
  private.bean_is_conversation_member(
    p_conversation_id uuid,
    p_user_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bean_conversation_members m
    where
      m.conversation_id = p_conversation_id
      and m.user_id = p_user_id
      and m.removed_at is null
  );
$$;


revoke execute
on function
  private.bean_is_conversation_member(uuid, uuid)
from public;

grant execute
on function
  private.bean_is_conversation_member(uuid, uuid)
to authenticated;


/* ============================================================
   SECURITY HELPER:
   SHARED CONVERSATION
   ============================================================ */

create or replace function
  private.bean_users_share_conversation(
    p_user_a uuid,
    p_user_b uuid
  )
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bean_conversation_members a
    join public.bean_conversation_members b
      on b.conversation_id = a.conversation_id
    where
      a.user_id = p_user_a
      and b.user_id = p_user_b
      and a.removed_at is null
      and b.removed_at is null
  );
$$;


revoke execute
on function
  private.bean_users_share_conversation(uuid, uuid)
from public;

grant execute
on function
  private.bean_users_share_conversation(uuid, uuid)
to authenticated;


/* ============================================================
   06. MESSAGES

   ONLY encrypted message envelope is stored.
   No plaintext content column exists.
   ============================================================ */

create table if not exists public.bean_messages (
  id uuid primary key
    default gen_random_uuid(),

  client_message_id uuid not null,

  conversation_id uuid not null
    references public.bean_conversations(id)
    on delete cascade,

  sender_id uuid not null
    references public.bean_user_profiles(id)
    on delete restrict,

  message_type text not null
    check (
      message_type in (
        'text',
        'image',
        'video',
        'audio',
        'voice',
        'file',
        'location',
        'contact',
        'poll',
        'beanmoji',
        'system',
        'call'
      )
    ),

  ciphertext jsonb not null,

  metadata jsonb
    not null default '{}'::jsonb,

  reply_to uuid
    references public.bean_messages(id)
    on delete set null,

  edited_at timestamptz,

  deleted_at timestamptz,

  expires_at timestamptz,

  created_at timestamptz
    not null default now(),

  unique (
    sender_id,
    client_message_id
  )
);


create index if not exists
  bean_messages_conversation_cursor_idx
on public.bean_messages (
  conversation_id,
  created_at desc,
  id desc
);


create index if not exists
  bean_messages_sender_idx
on public.bean_messages (
  sender_id,
  created_at desc
);


create index if not exists
  bean_messages_expiry_idx
on public.bean_messages (
  expires_at
)
where expires_at is not null;


/* ============================================================
   REPLY VALIDATION

   Reply target must belong to the same conversation.
   ============================================================ */

create or replace function
  private.bean_validate_message_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reply_conversation uuid;
begin
  if new.reply_to is null then
    return new;
  end if;

  select m.conversation_id
  into v_reply_conversation
  from public.bean_messages m
  where m.id = new.reply_to;

  if v_reply_conversation is null then
    raise exception
      'reply_message_not_found';
  end if;

  if v_reply_conversation <> new.conversation_id then
    raise exception
      'reply_message_wrong_conversation';
  end if;

  return new;
end;
$$;


drop trigger if exists
  bean_messages_validate_reply
on public.bean_messages;

create trigger
  bean_messages_validate_reply
before insert or update of reply_to, conversation_id
on public.bean_messages
for each row
execute function
  private.bean_validate_message_reply();


/* ============================================================
   TOUCH CONVERSATION ON NEW MESSAGE
   ============================================================ */

create or replace function
  private.bean_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bean_conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;


drop trigger if exists
  bean_messages_touch_conversation
on public.bean_messages;

create trigger
  bean_messages_touch_conversation
after insert
on public.bean_messages
for each row
execute function
  private.bean_touch_conversation();


/* ============================================================
   07. MESSAGE REACTIONS
   ============================================================ */

create table if not exists public.bean_message_reactions (
  message_id uuid not null
    references public.bean_messages(id)
    on delete cascade,

  user_id uuid not null
    references public.bean_user_profiles(id)
    on delete cascade,

  reaction text not null
    check (
      char_length(reaction)
      between 1 and 64
    ),

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  primary key (
    message_id,
    user_id
  )
);


create index if not exists
  bean_message_reactions_user_idx
on public.bean_message_reactions (
  user_id
);


drop trigger if exists
  bean_message_reactions_updated_at
on public.bean_message_reactions;

create trigger
  bean_message_reactions_updated_at
before update
on public.bean_message_reactions
for each row
execute function
  private.bean_set_updated_at();


/* ============================================================
   08. MEDIA OBJECTS

   Physical bytes live in private bean-media bucket.

   DB stores ciphertext metadata/path only.
   ============================================================ */

create table if not exists public.bean_media_objects (
  id uuid primary key
    default gen_random_uuid(),

  conversation_id uuid not null
    references public.bean_conversations(id)
    on delete cascade,

  owner_id uuid not null
    references public.bean_user_profiles(id)
    on delete restrict,

  kind text not null
    check (
      kind in (
        'image',
        'video',
        'audio',
        'voice',
        'file'
      )
    ),

  bucket text not null
    default 'bean-media'
    check (
      bucket = 'bean-media'
    ),

  storage_path text not null unique,

  ciphertext_size bigint not null
    check (
      ciphertext_size > 0
      and ciphertext_size <= 104857600
    ),

  status text not null
    default 'ready'
    check (
      status in (
        'ready',
        'deleted'
      )
    ),

  created_at timestamptz
    not null default now(),

  deleted_at timestamptz
);


create index if not exists
  bean_media_objects_conversation_idx
on public.bean_media_objects (
  conversation_id,
  created_at desc
);


create index if not exists
  bean_media_objects_owner_idx
on public.bean_media_objects (
  owner_id
);


/* ============================================================
   09. WORK SERVICES
   ============================================================ */

create table if not exists public.bean_work_services (
  id uuid primary key
    default gen_random_uuid(),

  owner_id uuid not null
    references public.bean_user_profiles(id)
    on delete cascade,

  title text not null
    check (
      char_length(title)
      between 1 and 100
    ),

  description text not null
    check (
      char_length(description)
      between 1 and 2000
    ),

  category text
    check (
      category is null
      or char_length(category) <= 100
    ),

  budget_type text not null
    check (
      budget_type in (
        'fixed',
        'hourly',
        'negotiable'
      )
    ),

  price_amount numeric(14,2)
    check (
      price_amount is null
      or price_amount >= 0
    ),

  currency text
    check (
      currency is null
      or currency ~ '^[A-Z]{3}$'
    ),

  status text not null
    default 'draft'
    check (
      status in (
        'draft',
        'active',
        'paused',
        'archived'
      )
    ),

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);


create index if not exists
  bean_work_services_owner_idx
on public.bean_work_services (
  owner_id,
  updated_at desc
);


create index if not exists
  bean_work_services_active_idx
on public.bean_work_services (
  category,
  updated_at desc
)
where status = 'active';


drop trigger if exists
  bean_work_services_updated_at
on public.bean_work_services;

create trigger
  bean_work_services_updated_at
before update
on public.bean_work_services
for each row
execute function
  private.bean_set_updated_at();


/* ============================================================
   10. WORK PROJECTS
   ============================================================ */

create table if not exists public.bean_work_projects (
  id uuid primary key
    default gen_random_uuid(),

  client_id uuid not null
    references public.bean_user_profiles(id)
    on delete restrict,

  hired_user_id uuid
    references public.bean_user_profiles(id)
    on delete set null,

  accepted_proposal_id uuid,

  title text not null
    check (
      char_length(title)
      between 1 and 120
    ),

  description text not null
    check (
      char_length(description)
      between 1 and 5000
    ),

  category text
    check (
      category is null
      or char_length(category) <= 100
    ),

  budget_type text not null
    check (
      budget_type in (
        'fixed',
        'hourly',
        'negotiable'
      )
    ),

  budget_amount numeric(14,2)
    check (
      budget_amount is null
      or budget_amount >= 0
    ),

  currency text
    check (
      currency is null
      or currency ~ '^[A-Z]{3}$'
    ),

  status text not null
    default 'open'
    check (
      status in (
        'open',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);


create index if not exists
  bean_work_projects_client_idx
on public.bean_work_projects (
  client_id,
  updated_at desc
);


create index if not exists
  bean_work_projects_hired_idx
on public.bean_work_projects (
  hired_user_id,
  updated_at desc
)
where hired_user_id is not null;


create index if not exists
  bean_work_projects_open_idx
on public.bean_work_projects (
  category,
  created_at desc
)
where status = 'open';


drop trigger if exists
  bean_work_projects_updated_at
on public.bean_work_projects;

create trigger
  bean_work_projects_updated_at
before update
on public.bean_work_projects
for each row
execute function
  private.bean_set_updated_at();


/* ============================================================
   11. WORK PROPOSALS
   ============================================================ */

create table if not exists public.bean_work_proposals (
  id uuid primary key
    default gen_random_uuid(),

  project_id uuid not null
    references public.bean_work_projects(id)
    on delete cascade,

  sender_id uuid not null
    references public.bean_user_profiles(id)
    on delete cascade,

  message text not null
    check (
      char_length(message)
      between 1 and 3000
    ),

  amount numeric(14,2)
    check (
      amount is null
      or amount >= 0
    ),

  currency text
    check (
      currency is null
      or currency ~ '^[A-Z]{3}$'
    ),

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'declined',
        'withdrawn'
      )
    ),

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  unique (
    project_id,
    sender_id
  )
);


create index if not exists
  bean_work_proposals_project_idx
on public.bean_work_proposals (
  project_id,
  created_at
);


create index if not exists
  bean_work_proposals_sender_idx
on public.bean_work_proposals (
  sender_id,
  created_at desc
);


drop trigger if exists
  bean_work_proposals_updated_at
on public.bean_work_proposals;

create trigger
  bean_work_proposals_updated_at
before update
on public.bean_work_proposals
for each row
execute function
  private.bean_set_updated_at();


/* ============================================================
   ROW LEVEL SECURITY
   ============================================================ */

alter table public.bean_user_profiles
enable row level security;

alter table public.bean_user_handles
enable row level security;

alter table public.bean_user_blocks
enable row level security;

alter table public.bean_conversations
enable row level security;

alter table public.bean_conversation_members
enable row level security;

alter table public.bean_messages
enable row level security;

alter table public.bean_message_reactions
enable row level security;

alter table public.bean_media_objects
enable row level security;

alter table public.bean_work_services
enable row level security;

alter table public.bean_work_projects
enable row level security;

alter table public.bean_work_proposals
enable row level security;


/* ============================================================
   CLEAN POLICY RE-RUN SUPPORT
   ============================================================ */

drop policy if exists
  "bean profiles select"
on public.bean_user_profiles;

drop policy if exists
  "bean profiles insert own"
on public.bean_user_profiles;

drop policy if exists
  "bean profiles update own"
on public.bean_user_profiles;


/* ============================================================
   PROFILE POLICIES
   ============================================================ */

create policy
  "bean profiles select"
on public.bean_user_profiles
for select
to authenticated
using (
  id = (select auth.uid())

  or is_discoverable = true

  or (
    select
      private.bean_users_share_conversation(
        (select auth.uid()),
        id
      )
  )
);


create policy
  "bean profiles insert own"
on public.bean_user_profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
);


create policy
  "bean profiles update own"
on public.bean_user_profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);


/* ============================================================
   HANDLE POLICIES
   ============================================================ */

drop policy if exists
  "bean handles select"
on public.bean_user_handles;

drop policy if exists
  "bean handles claim own"
on public.bean_user_handles;


create policy
  "bean handles select"
on public.bean_user_handles
for select
to authenticated
using (
  user_id = (select auth.uid())

  or exists (
    select 1
    from public.bean_user_profiles p
    where
      p.id = user_id
      and p.is_discoverable = true
  )

  or (
    select
      private.bean_users_share_conversation(
        (select auth.uid()),
        user_id
      )
  )
);


create policy
  "bean handles claim own"
on public.bean_user_handles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
);


/* ============================================================
   BLOCK POLICIES
   ============================================================ */

drop policy if exists
  "bean blocks own"
on public.bean_user_blocks;


create policy
  "bean blocks own"
on public.bean_user_blocks
for all
to authenticated
using (
  blocker_id = (select auth.uid())
)
with check (
  blocker_id = (select auth.uid())
);


/* ============================================================
   CONVERSATION POLICIES
   ============================================================ */

drop policy if exists
  "bean conversations member select"
on public.bean_conversations;


create policy
  "bean conversations member select"
on public.bean_conversations
for select
to authenticated
using (
  (
    select
      private.bean_is_conversation_member(
        id,
        (select auth.uid())
      )
  )
);


/* ============================================================
   MEMBERSHIP POLICIES
   ============================================================ */

drop policy if exists
  "bean members conversation select"
on public.bean_conversation_members;

drop policy if exists
  "bean members own state update"
on public.bean_conversation_members;


create policy
  "bean members conversation select"
on public.bean_conversation_members
for select
to authenticated
using (
  (
    select
      private.bean_is_conversation_member(
        conversation_id,
        (select auth.uid())
      )
  )
);


create policy
  "bean members own state update"
on public.bean_conversation_members
for update
to authenticated
using (
  user_id = (select auth.uid())
  and removed_at is null
)
with check (
  user_id = (select auth.uid())
);


/* ============================================================
   MESSAGE POLICIES
   ============================================================ */

drop policy if exists
  "bean messages member select"
on public.bean_messages;

drop policy if exists
  "bean messages member insert"
on public.bean_messages;

drop policy if exists
  "bean messages sender update"
on public.bean_messages;


create policy
  "bean messages member select"
on public.bean_messages
for select
to authenticated
using (
  (
    select
      private.bean_is_conversation_member(
        conversation_id,
        (select auth.uid())
      )
  )
);


create policy
  "bean messages member insert"
on public.bean_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())

  and (
    select
      private.bean_is_conversation_member(
        conversation_id,
        (select auth.uid())
      )
  )
);


create policy
  "bean messages sender update"
on public.bean_messages
for update
to authenticated
using (
  sender_id = (select auth.uid())

  and (
    select
      private.bean_is_conversation_member(
        conversation_id,
        (select auth.uid())
      )
  )
)
with check (
  sender_id = (select auth.uid())

  and (
    select
      private.bean_is_conversation_member(
        conversation_id,
        (select auth.uid())
      )
  )
);


/* ============================================================
   REACTION POLICIES
   ============================================================ */

drop policy if exists
  "bean reactions member select"
on public.bean_message_reactions;

drop policy if exists
  "bean reactions own insert"
on public.bean_message_reactions;

drop policy if exists
  "bean reactions own update"
on public.bean_message_reactions;

drop policy if exists
  "bean reactions own delete"
on public.bean_message_reactions;


create policy
  "bean reactions member select"
on public.bean_message_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.bean_messages m
    where
      m.id = message_id

      and (
        select
          private.bean_is_conversation_member(
            m.conversation_id,
            (select auth.uid())
          )
      )
  )
);


create policy
  "bean reactions own insert"
on public.bean_message_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())

  and exists (
    select 1
    from public.bean_messages m
    where
      m.id = message_id

      and (
        select
          private.bean_is_conversation_member(
            m.conversation_id,
            (select auth.uid())
          )
      )
  )
);


create policy
  "bean reactions own update"
on public.bean_message_reactions
for update
to authenticated
using (
  user_id = (select auth.uid())
)
with check (
  user_id = (select auth.uid())
);


create policy
  "bean reactions own delete"
on public.bean_message_reactions
for delete
to authenticated
using (
  user_id = (select auth.uid())
);


/* ============================================================
   MEDIA POLICIES
   ============================================================ */

drop policy if exists
  "bean media member select"
on public.bean_media_objects;

drop policy if exists
  "bean media owner insert"
on public.bean_media_objects;

drop policy if exists
  "bean media owner update"
on public.bean_media_objects;


create policy
  "bean media member select"
on public.bean_media_objects
for select
to authenticated
using (
  (
    select
      private.bean_is_conversation_member(
        conversation_id,
        (select auth.uid())
      )
  )
);


create policy
  "bean media owner insert"
on public.bean_media_objects
for insert
to authenticated
with check (
  owner_id = (select auth.uid())

  and bucket = 'bean-media'

  and (
    select
      private.bean_is_conversation_member(
        conversation_id,
        (select auth.uid())
      )
  )
);


create policy
  "bean media owner update"
on public.bean_media_objects
for update
to authenticated
using (
  owner_id = (select auth.uid())
)
with check (
  owner_id = (select auth.uid())
);


/* ============================================================
   WORK SERVICE POLICIES
   ============================================================ */

drop policy if exists
  "bean services select"
on public.bean_work_services;

drop policy if exists
  "bean services insert own"
on public.bean_work_services;

drop policy if exists
  "bean services update own"
on public.bean_work_services;


create policy
  "bean services select"
on public.bean_work_services
for select
to authenticated
using (
  status = 'active'
  or owner_id = (select auth.uid())
);


create policy
  "bean services insert own"
on public.bean_work_services
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
);


create policy
  "bean services update own"
on public.bean_work_services
for update
to authenticated
using (
  owner_id = (select auth.uid())
)
with check (
  owner_id = (select auth.uid())
);


/* ============================================================
   PROJECT POLICIES
   ============================================================ */

drop policy if exists
  "bean projects select"
on public.bean_work_projects;

drop policy if exists
  "bean projects insert own"
on public.bean_work_projects;

drop policy if exists
  "bean projects client update"
on public.bean_work_projects;


create policy
  "bean projects select"
on public.bean_work_projects
for select
to authenticated
using (
  status = 'open'

  or client_id = (select auth.uid())

  or hired_user_id = (select auth.uid())

  or exists (
    select 1
    from public.bean_work_proposals p
    where
      p.project_id = id
      and p.sender_id = (select auth.uid())
  )
);


create policy
  "bean projects insert own"
on public.bean_work_projects
for insert
to authenticated
with check (
  client_id = (select auth.uid())

  and hired_user_id is null
  and accepted_proposal_id is null
  and status = 'open'
);


create policy
  "bean projects client update"
on public.bean_work_projects
for update
to authenticated
using (
  client_id = (select auth.uid())
)
with check (
  client_id = (select auth.uid())
);


/* ============================================================
   PROPOSAL POLICIES
   ============================================================ */

drop policy if exists
  "bean proposals select participants"
on public.bean_work_proposals;

drop policy if exists
  "bean proposals sender insert"
on public.bean_work_proposals;

drop policy if exists
  "bean proposals sender withdraw"
on public.bean_work_proposals;


create policy
  "bean proposals select participants"
on public.bean_work_proposals
for select
to authenticated
using (
  sender_id = (select auth.uid())

  or exists (
    select 1
    from public.bean_work_projects p
    where
      p.id = project_id
      and p.client_id = (select auth.uid())
  )
);


create policy
  "bean proposals sender insert"
on public.bean_work_proposals
for insert
to authenticated
with check (
  sender_id = (select auth.uid())

  and status = 'pending'

  and exists (
    select 1
    from public.bean_work_projects p
    where
      p.id = project_id
      and p.status = 'open'
      and p.client_id <> (select auth.uid())
  )
);


create policy
  "bean proposals sender withdraw"
on public.bean_work_proposals
for update
to authenticated
using (
  sender_id = (select auth.uid())
  and status = 'pending'
)
with check (
  sender_id = (select auth.uid())
  and status = 'withdrawn'
);


/* ============================================================
   API GRANTS

   Revoke broad access first.
   ============================================================ */

revoke all
on table public.bean_user_profiles
from anon, authenticated;

revoke all
on table public.bean_user_handles
from anon, authenticated;

revoke all
on table public.bean_user_blocks
from anon, authenticated;

revoke all
on table public.bean_conversations
from anon, authenticated;

revoke all
on table public.bean_conversation_members
from anon, authenticated;

revoke all
on table public.bean_messages
from anon, authenticated;

revoke all
on table public.bean_message_reactions
from anon, authenticated;

revoke all
on table public.bean_media_objects
from anon, authenticated;

revoke all
on table public.bean_work_services
from anon, authenticated;

revoke all
on table public.bean_work_projects
from anon, authenticated;

revoke all
on table public.bean_work_proposals
from anon, authenticated;


/* ============================================================
   EXACT AUTHENTICATED GRANTS
   ============================================================ */

grant select, insert
on public.bean_user_profiles
to authenticated;

grant update (
  display_name,
  bio,
  avatar_path,
  profile_type,
  city,
  country_code,
  is_discoverable,
  is_available_for_work
)
on public.bean_user_profiles
to authenticated;


grant select, insert
on public.bean_user_handles
to authenticated;


grant select, insert, delete
on public.bean_user_blocks
to authenticated;


grant select
on public.bean_conversations
to authenticated;


grant select
on public.bean_conversation_members
to authenticated;

grant update (
  last_read_at,
  muted_until
)
on public.bean_conversation_members
to authenticated;


grant select, insert
on public.bean_messages
to authenticated;

grant update (
  ciphertext,
  metadata,
  edited_at,
  deleted_at,
  expires_at
)
on public.bean_messages
to authenticated;


grant select, insert, delete
on public.bean_message_reactions
to authenticated;

grant update (
  reaction
)
on public.bean_message_reactions
to authenticated;


grant select, insert
on public.bean_media_objects
to authenticated;

grant update (
  status,
  deleted_at
)
on public.bean_media_objects
to authenticated;


grant select, insert, update
on public.bean_work_services
to authenticated;


grant select, insert
on public.bean_work_projects
to authenticated;

grant update (
  status
)
on public.bean_work_projects
to authenticated;


grant select, insert
on public.bean_work_proposals
to authenticated;

grant update (
  status
)
on public.bean_work_proposals
to authenticated;


/* ============================================================
   DISCOVERY SAFE VIEW

   Browser never searches raw account/auth tables.

   security_invoker means underlying RLS still applies.
   ============================================================ */

drop view if exists
  public.bean_discovery_profiles;


create view
  public.bean_discovery_profiles
with (
  security_invoker = true
)
as
select
  p.id as user_id,

  h.handle,

  p.display_name,

  p.bio,

  p.avatar_path,

  p.profile_type,

  p.city,

  p.country_code,

  p.is_available_for_work

from public.bean_user_profiles p

join public.bean_user_handles h
  on h.user_id = p.id

where
  p.is_discoverable = true;


revoke all
on public.bean_discovery_profiles
from public, anon;

grant select
on public.bean_discovery_profiles
to authenticated;


/* ============================================================
   RPC 01:
   CREATE / REUSE DIRECT CONVERSATION

   Atomic.
   UUID-based.
   No mutable usernames.
   ============================================================ */

create or replace function
  public.bean_create_direct_conversation(
    p_peer_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_direct_key text;
  v_conversation_id uuid;
begin
  v_user_id :=
    auth.uid();


  if v_user_id is null then
    raise exception
      'authentication_required';
  end if;


  if p_peer_id is null
     or p_peer_id = v_user_id then
    raise exception
      'invalid_peer';
  end if;


  if not exists (
    select 1
    from public.bean_user_profiles p
    where p.id = v_user_id
  ) then
    raise exception
      'current_identity_not_found';
  end if;


  if not exists (
    select 1
    from public.bean_user_profiles p
    where p.id = p_peer_id
  ) then
    raise exception
      'peer_identity_not_found';
  end if;


  if exists (
    select 1
    from public.bean_user_blocks b
    where
      (
        b.blocker_id = v_user_id
        and b.blocked_id = p_peer_id
      )
      or
      (
        b.blocker_id = p_peer_id
        and b.blocked_id = v_user_id
      )
  ) then
    raise exception
      'conversation_not_allowed';
  end if;


  v_direct_key :=
    least(
      v_user_id::text,
      p_peer_id::text
    )
    || ':' ||
    greatest(
      v_user_id::text,
      p_peer_id::text
    );


  select c.id
  into v_conversation_id
  from public.bean_conversations c
  where c.direct_key = v_direct_key;


  if v_conversation_id is null then

    insert into public.bean_conversations (
      kind,
      created_by,
      direct_key
    )
    values (
      'direct',
      v_user_id,
      v_direct_key
    )
    on conflict (direct_key)
    do nothing
    returning id
    into v_conversation_id;


    if v_conversation_id is null then
      select c.id
      into v_conversation_id
      from public.bean_conversations c
      where c.direct_key =
        v_direct_key;
    end if;

  end if;


  insert into public.bean_conversation_members (
    conversation_id,
    user_id,
    role
  )
  values
    (
      v_conversation_id,
      v_user_id,
      'member'
    ),
    (
      v_conversation_id,
      p_peer_id,
      'member'
    )
  on conflict (
    conversation_id,
    user_id
  )
  do update
  set removed_at = null;


  return v_conversation_id;
end;
$$;


revoke execute
on function
  public.bean_create_direct_conversation(uuid)
from public, anon;

grant execute
on function
  public.bean_create_direct_conversation(uuid)
to authenticated;


/* ============================================================
   RPC 02:
   ACCEPT WORK PROPOSAL

   Atomic transaction:

   pending proposal
        ↓
   accepted

   other proposals
        ↓
   declined

   project
        ↓
   in_progress
   ============================================================ */

create or replace function
  public.bean_accept_work_proposal(
    p_proposal_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_sender_id uuid;
begin
  v_user_id :=
    auth.uid();


  if v_user_id is null then
    raise exception
      'authentication_required';
  end if;


  select
    proposal.project_id,
    proposal.sender_id

  into
    v_project_id,
    v_sender_id

  from public.bean_work_proposals proposal

  join public.bean_work_projects project
    on project.id =
      proposal.project_id

  where
    proposal.id =
      p_proposal_id

    and proposal.status =
      'pending'

    and project.status =
      'open'

    and project.client_id =
      v_user_id

  for update of
    proposal,
    project;


  if v_project_id is null then
    raise exception
      'proposal_not_available';
  end if;


  update public.bean_work_proposals
  set status = 'declined'
  where
    project_id = v_project_id
    and id <> p_proposal_id
    and status = 'pending';


  update public.bean_work_proposals
  set status = 'accepted'
  where id = p_proposal_id;


  update public.bean_work_projects
  set
    hired_user_id =
      v_sender_id,

    accepted_proposal_id =
      p_proposal_id,

    status =
      'in_progress'

  where
    id = v_project_id
    and client_id = v_user_id
    and status = 'open';


  if not found then
    raise exception
      'project_state_changed';
  end if;


  return v_project_id;
end;
$$;


revoke execute
on function
  public.bean_accept_work_proposal(uuid)
from public, anon;

grant execute
on function
  public.bean_accept_work_proposal(uuid)
to authenticated;


/* ============================================================
   REALTIME TOPIC PARSER

   Supported private topics:

     conversation:<UUID>

     presence:conversation:<UUID>
   ============================================================ */

create or replace function
  private.bean_topic_conversation_id(
    p_topic text
  )
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_value text;
begin

  if p_topic like
    'conversation:%'
  then
    v_value :=
      split_part(
        p_topic,
        ':',
        2
      );

  elsif p_topic like
    'presence:conversation:%'
  then
    v_value :=
      split_part(
        p_topic,
        ':',
        3
      );

  else
    return null;
  end if;


  if v_value !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  then
    return null;
  end if;


  return v_value::uuid;

exception
  when invalid_text_representation then
    return null;
end;
$$;


revoke execute
on function
  private.bean_topic_conversation_id(text)
from public;

grant execute
on function
  private.bean_topic_conversation_id(text)
to authenticated;


/* ============================================================
   REALTIME AUTHORIZATION

   Controls:

   conversation:<UUID>
     - DB message/reaction broadcasts

   presence:conversation:<UUID>
     - Presence
     - Typing broadcasts

   Supabase Realtime already enables RLS on
   realtime.messages.
   ============================================================ */

drop policy if exists
  "bean realtime members receive"
on realtime.messages;

drop policy if exists
  "bean realtime members send"
on realtime.messages;


create policy
  "bean realtime members receive"
on realtime.messages
for select
to authenticated
using (
  extension in (
    'broadcast',
    'presence'
  )

  and (
    select
      private.bean_is_conversation_member(
        private.bean_topic_conversation_id(
          realtime.topic()
        ),
        (select auth.uid())
      )
  )
);


create policy
  "bean realtime members send"
on realtime.messages
for insert
to authenticated
with check (
  extension in (
    'broadcast',
    'presence'
  )

  and (
    select
      private.bean_is_conversation_member(
        private.bean_topic_conversation_id(
          realtime.topic()
        ),
        (select auth.uid())
      )
  )
);


/* ============================================================
   REALTIME DATABASE BROADCAST

   realtime.ts expects exact event names:

     message.insert
     message.update

     reaction.insert
     reaction.update
     reaction.delete

     conversation.update

     member.insert
     member.update
     member.delete

   We therefore use realtime.send() rather than exposing
   broad Postgres Changes subscriptions.
   ============================================================ */

create or replace function
  private.bean_broadcast_conversation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_event text;
  v_record jsonb;
  v_old_record jsonb;
begin

  /* ----------------------------------------------------------
     Resolve conversation UUID
     ---------------------------------------------------------- */

  if tg_table_name =
    'bean_messages'
  then

    v_conversation_id :=
      coalesce(
        new.conversation_id,
        old.conversation_id
      );


  elsif tg_table_name =
    'bean_message_reactions'
  then

    select m.conversation_id
    into v_conversation_id
    from public.bean_messages m
    where
      m.id = coalesce(
        new.message_id,
        old.message_id
      );


  elsif tg_table_name =
    'bean_conversations'
  then

    v_conversation_id :=
      coalesce(
        new.id,
        old.id
      );


  elsif tg_table_name =
    'bean_conversation_members'
  then

    v_conversation_id :=
      coalesce(
        new.conversation_id,
        old.conversation_id
      );


  else
    return null;
  end if;


  if v_conversation_id is null then
    return null;
  end if;


  /* ----------------------------------------------------------
     Exact Bean event name
     ---------------------------------------------------------- */

  v_event :=
    tg_argv[0]
    || '.'
    || lower(tg_op);


  if tg_op <> 'DELETE' then
    v_record :=
      to_jsonb(new);
  else
    v_record :=
      null;
  end if;


  if tg_op <> 'INSERT' then
    v_old_record :=
      to_jsonb(old);
  else
    v_old_record :=
      null;
  end if;


  perform realtime.send(
    jsonb_build_object(
      'record',
        v_record,

      'oldRecord',
        v_old_record,

      'conversationId',
        v_conversation_id
    ),

    v_event,

    'conversation:'
      || v_conversation_id::text,

    true
  );


  return null;
end;
$$;


/* ============================================================
   MESSAGE BROADCAST
   ============================================================ */

drop trigger if exists
  bean_messages_realtime
on public.bean_messages;

create trigger
  bean_messages_realtime
after insert or update
on public.bean_messages
for each row
execute function
  private.bean_broadcast_conversation_change(
    'message'
  );


/* ============================================================
   REACTION BROADCAST
   ============================================================ */

drop trigger if exists
  bean_reactions_realtime
on public.bean_message_reactions;

create trigger
  bean_reactions_realtime
after insert or update or delete
on public.bean_message_reactions
for each row
execute function
  private.bean_broadcast_conversation_change(
    'reaction'
  );


/* ============================================================
   CONVERSATION BROADCAST
   ============================================================ */

drop trigger if exists
  bean_conversations_realtime
on public.bean_conversations;

create trigger
  bean_conversations_realtime
after update
on public.bean_conversations
for each row
execute function
  private.bean_broadcast_conversation_change(
    'conversation'
  );


/* ============================================================
   MEMBER BROADCAST
   ============================================================ */

drop trigger if exists
  bean_members_realtime
on public.bean_conversation_members;

create trigger
  bean_members_realtime
after insert or update or delete
on public.bean_conversation_members
for each row
execute function
  private.bean_broadcast_conversation_change(
    'member'
  );


/* ============================================================
   STORAGE — AVATARS

   bean-avatars is PUBLIC for reads.

   Writes remain restricted to:

     users/<current UUID>/avatar/...
   ============================================================ */

drop policy if exists
  "bean avatar owner insert"
on storage.objects;

drop policy if exists
  "bean avatar owner update"
on storage.objects;

drop policy if exists
  "bean avatar owner delete"
on storage.objects;


create policy
  "bean avatar owner insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'bean-avatars'

  and (
    storage.foldername(name)
  )[1] =
    'users'

  and (
    storage.foldername(name)
  )[2] =
    (select auth.uid())::text

  and (
    storage.foldername(name)
  )[3] =
    'avatar'
);


create policy
  "bean avatar owner update"
on storage.objects
for update
to authenticated
using (
  bucket_id =
    'bean-avatars'

  and owner_id =
    (select auth.uid())::text
)
with check (
  bucket_id =
    'bean-avatars'

  and owner_id =
    (select auth.uid())::text
);


create policy
  "bean avatar owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'bean-avatars'

  and owner_id =
    (select auth.uid())::text
);


/* ============================================================
   STORAGE — PRIVATE ENCRYPTED MEDIA

   Path:

   users/<UUID>/conversations/<conversation UUID>/<media UUID>.bin
   ============================================================ */

drop policy if exists
  "bean media storage insert"
on storage.objects;

drop policy if exists
  "bean media storage select"
on storage.objects;

drop policy if exists
  "bean media storage delete"
on storage.objects;


/* ============================================================
   MEDIA STORAGE INSERT

   DB media row is created AFTER upload, therefore insertion
   authorization uses path + membership.
   ============================================================ */

create policy
  "bean media storage insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'bean-media'

  and (
    storage.foldername(name)
  )[1] =
    'users'

  and (
    storage.foldername(name)
  )[2] =
    (select auth.uid())::text

  and (
    storage.foldername(name)
  )[3] =
    'conversations'

  and (
    storage.foldername(name)
  )[4] ~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'

  and (
    select
      private.bean_is_conversation_member(
        (
          storage.foldername(name)
        )[4]::uuid,

        (select auth.uid())
      )
  )
);


/* ============================================================
   MEDIA DOWNLOAD

   Requires matching registered media object
   and active conversation membership.
   ============================================================ */

create policy
  "bean media storage select"
on storage.objects
for select
to authenticated
using (
  bucket_id =
    'bean-media'

  and exists (
    select 1
    from public.bean_media_objects media
    where
      media.bucket =
        bucket_id

      and media.storage_path =
        name

      and media.status =
        'ready'

      and media.deleted_at
        is null

      and (
        select
          private.bean_is_conversation_member(
            media.conversation_id,
            (select auth.uid())
          )
      )
  )
);


/* ============================================================
   MEDIA PHYSICAL DELETE
   ============================================================ */

create policy
  "bean media storage delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'bean-media'

  and owner_id =
    (select auth.uid())::text

  and exists (
    select 1
    from public.bean_media_objects media
    where
      media.bucket =
        bucket_id

      and media.storage_path =
        name

      and media.owner_id =
        (select auth.uid())
  )
);


/* ============================================================
   FINAL SECURITY NOTES

   DO NOT expose:
     service_role
     sb_secret_*
     database password
     JWT signing secret

   Browser receives only:
     VITE_SUPABASE_URL
     VITE_SUPABASE_PUBLISHABLE_KEY

   RLS authorization uses:
     auth.uid()

   which must equal:
     Signaturesi permanent UUID

   Public Bean ID:
     bean@username

   is NEVER used for database authorization.
   ============================================================ */
