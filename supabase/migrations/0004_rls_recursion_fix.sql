-- ===========================================================================
-- 0004_rls_recursion_fix.sql — live-test finding: policy recursion (42P17)
--
-- Symptom (first real-database run, via Supabase REST with the anon key):
--   500 {"code":"42P17","message":"infinite recursion detected in policy for
--        relation \"rooms\""}   (same for room_seats / room_invites)
--
-- Cause: 0002's policies cross-reference tables that carry their own
--   cross-referencing policies:
--     rooms SELECT policy   -> subquery on room_seats
--                            -> room_seats SELECT policy
--                            -> subquery on rooms
--                            -> rooms SELECT policy -> ... (never ends)
--   Policy subqueries execute AS THE QUERYING ROLE, so RLS applies inside
--   them and the mutual references recurse forever; PostgreSQL aborts the
--   query with 42P17. This class of bug cannot appear in unit tests — it
--   only exists against a live database (exactly why PRD §5 demands
--   real-service testing).
--
-- Fix: the canonical Supabase pattern — every cross-table policy check goes
--   through a SECURITY DEFINER helper owned by the table owner (the owner
--   bypasses RLS), which breaks the cycle. Helpers take NO user parameter:
--   they derive auth.uid() themselves, so even a direct PostgREST call to
--   them can only answer questions about the CALLER ("do I host room X?",
--   "am I seated in room X?") — no cross-user information leak.
--
-- The rules are IDENTICAL to 0002/0003; only the evaluation path changes.
-- Fully idempotent (drop-and-recreate), safe to re-run.
-- ===========================================================================

-- Helper functions ----------------------------------------------------------
create or replace function public.has_active_seat(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.room_seats s
    where s.room_id = p_room_id
      and s.user_id = (select auth.uid())
      and s.expires_at > now()
  );
$$;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and r.host_user_id = (select auth.uid())
  );
$$;

create or replace function public.is_room_public(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and r.visibility = 'public'
  );
$$;

-- Policy evaluation runs as anon/authenticated, so those roles need EXECUTE.
grant execute on function public.has_active_seat(uuid)
  to anon, authenticated, service_role;
grant execute on function public.is_room_host(uuid)
  to anon, authenticated, service_role;
grant execute on function public.is_room_public(uuid)
  to anon, authenticated, service_role;

-- Rewritten policies (identical rules, no direct cross-table subqueries) ---
drop policy if exists "Rooms: readable per visibility" on public.rooms;
create policy "Rooms: readable per visibility"
  on public.rooms for select
  using (
    visibility = 'public'
    or host_user_id = (select auth.uid())
    or public.has_active_seat(rooms.id)
  );

drop policy if exists "Invites: host reads own room invites" on public.room_invites;
create policy "Invites: host reads own room invites"
  on public.room_invites for select
  using (public.is_room_host(room_invites.room_id));

drop policy if exists "Invites: host creates own room invites" on public.room_invites;
create policy "Invites: host creates own room invites"
  on public.room_invites for insert
  with check (
    created_by = (select auth.uid())
    and public.is_room_host(room_invites.room_id)
  );

-- Re-asserts 0003's hardened UPDATE policy (with WITH CHECK) in helper
-- form, so the final state is correct even if 0003 has not been run yet.
-- If 0003 is applied AFTER this file, re-run this file once: policies are
-- drop-and-recreate, so ordering self-heals.
drop policy if exists "Invites: host revokes own room invites" on public.room_invites;
create policy "Invites: host revokes own room invites"
  on public.room_invites for update
  using (public.is_room_host(room_invites.room_id))
  with check (
    public.is_room_host(room_invites.room_id)
    and room_invites.created_by = (select auth.uid())
  );

drop policy if exists "Seats: holders, hosts and public rooms read" on public.room_seats;
create policy "Seats: holders, hosts and public rooms read"
  on public.room_seats for select
  using (
    user_id = (select auth.uid())
    or public.is_room_host(room_seats.room_id)
    or public.is_room_public(room_seats.room_id)
  );

drop policy if exists "Seats: holders and hosts may delete seats" on public.room_seats;
create policy "Seats: holders and hosts may delete seats"
  on public.room_seats for delete
  using (
    user_id = (select auth.uid())
    or public.is_room_host(room_seats.room_id)
  );

-- Re-assert 0003's seat-write hardening (idempotent no-op if already
-- applied; makes this file sufficient on its own if 0003 was never run —
-- capacity/invite bypass stays closed either way).
revoke insert on table public.room_seats from anon, authenticated;
revoke update on table public.room_seats from anon, authenticated;
grant update (expires_at) on table public.room_seats to authenticated;
