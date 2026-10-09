-- Bean v3.2 database update. Run once in the Bean Supabase project: ajglvfoqiyrrisuoxecu
-- 1) Profile photo + About   2) Security lockdown. Safe to run more than once.

-- ---------- 1) profile ----------
create table if not exists public.bean_profiles (
  user_id    uuid primary key references public.bean_users(id) on delete cascade,
  avatar_url text,
  updated_at timestamptz not null default now()
);
alter table public.bean_profiles add column if not exists avatar_url  text;
alter table public.bean_profiles add column if not exists avatar_data text;
alter table public.bean_profiles add column if not exists avatar_v    bigint;
alter table public.bean_profiles add column if not exists bio         text;
alter table public.bean_profiles add column if not exists updated_at  timestamptz not null default now();
delete from public.bean_profiles a using public.bean_profiles b
  where a.user_id = b.user_id and a.ctid < b.ctid;
do $$ begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'bean_profiles' and indexdef ilike '%unique%(user_id)%') then
    create unique index bean_profiles_user_uniq on public.bean_profiles (user_id);
  end if;
end $$;

-- ---------- 2) security lockdown ----------
do $$
declare r record;
begin
  -- 1) remove every old policy on bean_* tables (old Bean let the browser read tables)
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename like 'bean\_%'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  -- 2) RLS on + no access for anon / logged-in Supabase users (service role still works)
  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'bean\_%'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('revoke all on table public.%I from anon, authenticated', r.tablename);
  end loop;

  -- 3) bean_* functions callable only by the server
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'bean\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;

  -- 4) chat files bucket private, and no browser policies on it
  update storage.buckets set public = false where id = 'bean-media';
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%bean-media%' or coalesce(with_check, '') like '%bean-media%')
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- realtime: stop broadcasting bean tables (Bean uses /api/sync, not realtime)
do $$
declare r record;
begin
  for r in
    select tablename from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename like 'bean\_%'
  loop
    execute format('alter publication supabase_realtime drop table public.%I', r.tablename);
  end loop;
exception when undefined_object then null;
end $$;

-- check: every number should be 0 and bucket_public false
select
  (select count(*) from pg_policies where schemaname = 'public' and tablename like 'bean\_%') as policies_left,
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'bean\_%' and not rowsecurity) as tables_without_rls,
  (select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and table_name like 'bean\_%' and grantee in ('anon', 'authenticated')) as anon_grants,
  (select public from storage.buckets where id = 'bean-media') as bucket_public;
