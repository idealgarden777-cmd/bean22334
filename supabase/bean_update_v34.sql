-- Bean 3.4: NEYO characters for Neyo Ghost
-- Run in Supabase project ajglvfoqiyrrisuoxecu (Bean), SQL Editor. Safe to run twice.
alter table public.bean_settings add column if not exists ghost_character text not null default 'neyo';
alter table public.bean_messages add column if not exists ghost_character text;
