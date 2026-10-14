-- ===========================================================================
-- Stage 5 / Step 6 — security hardening: RLS review findings + fixes
-- (IMPLEMENTATION_PLAN Step 6: "Review RLS ... validate server-side role
--  checks"; PRD §4: capacity enforced on the server, not only in the UI)
--
-- Finding 1 (critical): `room_seats` carried default table INSERT/UPDATE
--   privileges for authenticated clients. RLS on that table only checked
--   `user_id = auth.uid()`, so a hostile client talking to PostgREST
--   directly could bypass `reserve_room_seat` entirely:
--     * INSERT a seat into any room whose UUID is known — overfilling past
--       capacity, skipping private-room invites, entering closed rooms;
--     * UPDATE its own seat's `room_id` — migrating the seat into another
--       room (same bypass, one row at a time).
--   The application never does either (joins go through the advisory-
--   locked RPC; the heartbeat only extends `expires_at`), so revoking the
--   privileges is safe — and loud, if a regression ever reintroduces a
--   direct write. Capacity can now ONLY be granted by the RPC, which is
--   what 0002_rooms.sql always documented.
--
-- Finding 2 (medium): the `room_invites` UPDATE policy had no WITH CHECK,
--   so the INSERT-time rules (host's own room, own created_by) did not
--   apply to the row's NEW state — an invite could be moved into another
--   host's room. The policy now re-checks both on update.
-- ===========================================================================

-- Finding 1: seat writes are RPC-only ------------------------------------
revoke insert on table public.room_seats from anon, authenticated;
revoke update on table public.room_seats from anon, authenticated;
-- The heartbeat (renewSeatAction) may still extend its own seat's TTL —
-- column-level grant, nothing else is updatable from the client.
grant  update (expires_at) on table public.room_seats to authenticated;
-- service_role and the table owner (the SECURITY DEFINER RPC runs as the
-- owner) are unaffected by these revokes.

-- Finding 2: invite updates stay inside the host's own room ---------------
drop policy if exists "Invites: host revokes own room invites" on public.room_invites;
create policy "Invites: host revokes own room invites"
  on public.room_invites for update
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_invites.room_id
        and r.host_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.rooms r
      where r.id = room_invites.room_id
        and r.host_user_id = (select auth.uid())
    )
    and room_invites.created_by = (select auth.uid())
  );
