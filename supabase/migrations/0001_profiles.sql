-- ---------------------------------------------------------------------------
-- 0001_profiles.sql — public discovery profiles for the Cowork MVP
--
-- How to apply:
--   * Supabase Dashboard -> SQL Editor -> paste this file -> Run, OR
--   * `npx supabase db push` after linking the project (CLI).
--
-- Design notes (see PRD §7 / ARCHITECTURE §3):
--   * Emails are NEVER stored here — they live only in auth.users.
--     Discovery exposes only the fields below.
--   * CHECK constraints mirror src/lib/validation/profile.ts exactly, so
--     client-side validation and database enforcement agree.
--   * RLS: anyone may READ profiles (public discovery); only the owner may
--     INSERT/UPDATE their own row; there is no DELETE policy on purpose.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null,
  bio              text,
  skills           text[] not null default '{}',
  experience_level text not null,
  avatar_url       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint profiles_display_name_len
    check (char_length(display_name) between 1 and 50),
  constraint profiles_bio_len
    check (bio is null or char_length(bio) <= 500),
  constraint profiles_skills_count
    check (cardinality(skills) <= 12),
  constraint profiles_skills_item_len
    check (not exists (select 1 from unnest(skills) s where char_length(s) > 30)),
  -- App normalizes skills to lowercase; enforce it so search stays reliable.
  constraint profiles_skills_lowercase
    check (not exists (select 1 from unnest(skills) s where s <> lower(s))),
  constraint profiles_experience_level_valid
    check (experience_level in ('beginner', 'intermediate', 'advanced', 'expert')),
  constraint profiles_avatar_url_len
    check (avatar_url is null or char_length(avatar_url) <= 500)
);

-- Discovery filters (experience level) + fast skill lookups.
create index if not exists profiles_experience_level_idx
  on public.profiles (experience_level);

create index if not exists profiles_skills_idx
  on public.profiles using gin (skills);

-- updated_at maintenance ----------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Row Level Security --------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Deliberately NO delete policy: profiles cannot be removed via the anon key.
