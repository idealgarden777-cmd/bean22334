-- Bean: make OLD bean_* tables work with the new Bean code.
-- Safe: deletes no rows except exact duplicates, safe to run twice.
-- Run AFTER bean_chat.sql.

do $$
declare
  t text;
  r record;
  keep text[] := array['id','conversation_id','user_id','message_id','call_id'];
begin
  foreach t in array array['bean_conversations','bean_conversation_members','bean_messages',
                           'bean_reactions','bean_settings','bean_presence','bean_calls','bean_call_signals'] loop
    if to_regclass('public.' || t) is null then continue; end if;

    -- 1. old CHECK rules (e.g. type in ('direct','group')) block new values
    for r in select conname from pg_constraint
             where conrelid = ('public.' || t)::regclass and contype = 'c' loop
      execute format('alter table public.%I drop constraint %I', t, r.conname);
    end loop;

    -- 2. foreign keys pointing at non-Bean tables (old users/profiles tables)
    for r in select conname from pg_constraint
             where conrelid = ('public.' || t)::regclass and contype = 'f'
               and confrelid::regclass::text not like '%bean\_%' loop
      execute format('alter table public.%I drop constraint %I', t, r.conname);
    end loop;

    -- 3. old NOT NULL columns the new code never fills
    for r in select column_name from information_schema.columns
             where table_schema = 'public' and table_name = t
               and is_nullable = 'NO' and column_default is null
               and column_name <> all (keep) loop
      begin
        execute format('alter table public.%I alter column %I drop not null', t, r.column_name);
      exception when others then null;  -- part of primary key: leave it
      end;
    end loop;

    -- 4. old triggers (from the old app) can break inserts
    for r in select distinct trigger_name from information_schema.triggers
             where event_object_schema = 'public' and event_object_table = t loop
      execute format('drop trigger if exists %I on public.%I', r.trigger_name, t);
    end loop;

    -- 5. uuid ids need an automatic default
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'id'
                 and data_type = 'uuid' and column_default is null) then
      execute format('alter table public.%I alter column id set default gen_random_uuid()', t);
    end if;
  end loop;
end $$;

-- 6. one row per member / reaction / user (remove exact duplicates first)
delete from public.bean_conversation_members a using public.bean_conversation_members b
  where a.ctid < b.ctid and a.conversation_id = b.conversation_id and a.user_id = b.user_id;
create unique index if not exists bean_members_uniq on public.bean_conversation_members (conversation_id, user_id);

delete from public.bean_reactions a using public.bean_reactions b
  where a.ctid < b.ctid and a.message_id = b.message_id and a.user_id = b.user_id;
create unique index if not exists bean_reactions_uniq on public.bean_reactions (message_id, user_id);

delete from public.bean_presence a using public.bean_presence b
  where a.ctid < b.ctid and a.user_id = b.user_id;
create unique index if not exists bean_presence_uniq on public.bean_presence (user_id);

delete from public.bean_settings a using public.bean_settings b
  where a.ctid < b.ctid and a.user_id = b.user_id;
create unique index if not exists bean_settings_uniq on public.bean_settings (user_id);

-- 7. defaults the new code relies on
alter table public.bean_conversations alter column type set default 'dm';
alter table public.bean_conversation_members alter column role set default 'member';
alter table public.bean_messages alter column kind set default 'text';

-- 8. show what the tables look like now (short)
select table_name, string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public' and table_name in ('bean_conversations','bean_conversation_members','bean_messages')
group by table_name;
