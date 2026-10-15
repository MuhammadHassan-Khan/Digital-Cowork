-- ---------------------------------------------------------------------------
-- 0002_rooms.sql — rooms, private invites, seat reservations (Step 3)
--
-- How to apply:
--   * Supabase Dashboard -> SQL Editor -> paste this file -> Run, OR
--   * `npx supabase db push` after linking the project (CLI).
--
-- Design notes (ARCHITECTURE §3 "Live presence and participant capacity"):
--   * Capacity is enforced SERVER-SIDE in `reserve_room_seat`, not in the UI.
--   * Reservations are short-lived rows in `room_seats`; abandoned ones expire
--     automatically so a crashed browser cannot block a room forever.
--   * A per-room advisory lock serializes concurrent joins, closing the
--     "two people race for the last seat" window (tested in Stage 2 report).
--   * Stage 3 will reconcile seats with LiveKit presence and shorten the TTL
--     into a heartbeat; the reservation gate stays the same.
--   * Invite secrets are stored ONLY as sha256 hashes (PRD §7).
-- ---------------------------------------------------------------------------

-- rooms ------------------------------------------------------------------------
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  description  text,
  focus_tag    text,
  visibility   text not null default 'public',
  capacity     integer not null default 4,
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint rooms_title_len check (char_length(title) between 1 and 80),
  constraint rooms_description_len check (description is null or char_length(description) <= 500),
  constraint rooms_focus_tag_len check (focus_tag is null or char_length(focus_tag) <= 30),
  constraint rooms_visibility_valid check (visibility in ('public', 'private')),
  -- PRD: maximum 10 participants; minimum 2 for a meaningful shared room.
  constraint rooms_capacity_range check (capacity between 2 and 10),
  constraint rooms_status_valid check (status in ('open', 'closed'))
);

create index if not exists rooms_public_open_idx
  on public.rooms (created_at desc)
  where visibility = 'public' and status = 'open';

create index if not exists rooms_host_idx on public.rooms (host_user_id);

-- room_invites ----------------------------------------------------------------
-- Raw invite secrets are NEVER stored: the client receives the raw token once,
-- the database keeps only its sha256 hash.
create table if not exists public.room_invites (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  constraint room_invites_hash_len check (char_length(token_hash) = 64)
);

create index if not exists room_invites_room_idx on public.room_invites (room_id);

-- room_seats ------------------------------------------------------------------
-- One active reservation = one participant slot. `expires_at` keeps abandoned
-- reservations from permanently consuming capacity.
-- user_id references profiles (not auth.users) so PostgREST can embed
-- display names in one round-trip; every member reaching a room already has
-- a profile (the app layout enforces onboarding before /rooms).
create table if not exists public.room_seats (
  room_id     uuid not null references public.rooms (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reserved_at timestamptz not null default now(),
  expires_at  timestamptz not null,
  primary key (room_id, user_id)
);

-- NOTE: a partial predicate `where expires_at > now()` is illegal here —
-- index predicates may only use IMMUTABLE functions and now() is STABLE
-- (PostgreSQL error 42P17). Expired rows are reaped inside
-- reserve_room_seat anyway, so a full (room_id) index is the right shape.
create index if not exists room_seats_room_idx
  on public.room_seats (room_id);

-- updated_at trigger for rooms ----------------------------------------------
drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.room_invites enable row level security;
alter table public.room_seats enable row level security;

drop policy if exists "Rooms: readable per visibility" on public.rooms;
create policy "Rooms: readable per visibility"
  on public.rooms for select
  using (
    visibility = 'public'
    or host_user_id = (select auth.uid())
    or exists (
      select 1 from public.room_seats s
      where s.room_id = rooms.id
        and s.user_id = (select auth.uid())
        and s.expires_at > now()
    )
  );

drop policy if exists "Rooms: host inserts own rooms" on public.rooms;
create policy "Rooms: host inserts own rooms"
  on public.rooms for insert
  with check (host_user_id = (select auth.uid()));

drop policy if exists "Rooms: host updates own rooms" on public.rooms;
create policy "Rooms: host updates own rooms"
  on public.rooms for update
  using (host_user_id = (select auth.uid()))
  with check (host_user_id = (select auth.uid()));

drop policy if exists "Rooms: host deletes own rooms" on public.rooms;
create policy "Rooms: host deletes own rooms"
  on public.rooms for delete
  using (host_user_id = (select auth.uid()));

-- Invites: readable/creatable/revocable by the room host only.
-- (Guests validate invites through the security-definer RPCs below, so this
--  table never needs to be readable by non-hosts.)
drop policy if exists "Invites: host reads own room invites" on public.room_invites;
create policy "Invites: host reads own room invites"
  on public.room_invites for select
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_invites.room_id
        and r.host_user_id = (select auth.uid())
    )
  );

drop policy if exists "Invites: host creates own room invites" on public.room_invites;
create policy "Invites: host creates own room invites"
  on public.room_invites for insert
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.rooms r
      where r.id = room_invites.room_id
        and r.host_user_id = (select auth.uid())
    )
  );

drop policy if exists "Invites: host revokes own room invites" on public.room_invites;
create policy "Invites: host revokes own room invites"
  on public.room_invites for update
  using (
    exists (
      select 1 from public.rooms r
      where r.id = room_invites.room_id
        and r.host_user_id = (select auth.uid())
    )
  );

-- Seats:
--  * own seat: always visible/editable by its holder (join/leave)
--  * hosts: see/manage seats in their rooms
--  * public rooms: seat rows visible to authenticated members (occupancy list)
drop policy if exists "Seats: holders, hosts and public rooms read" on public.room_seats;
create policy "Seats: holders, hosts and public rooms read"
  on public.room_seats for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.rooms r
      where r.id = room_seats.room_id
        and (
          r.host_user_id = (select auth.uid())
          or r.visibility = 'public'
        )
    )
  );

drop policy if exists "Seats: holders may take/release own seat" on public.room_seats;
create policy "Seats: holders may take/release own seat"
  on public.room_seats for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "Seats: holders and hosts may delete seats" on public.room_seats;
create policy "Seats: holders and hosts may delete seats"
  on public.room_seats for delete
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.rooms r
      where r.id = room_seats.room_id
        and r.host_user_id = (select auth.uid())
    )
  );

-- Seat renewal (heartbeat): a member with an active seat may extend it.
-- Only refreshes an EXISTING seat — it can never create one (joining always
-- goes through reserve_room_seat, which enforces capacity and invites).
drop policy if exists "Seats: holders renew own seat" on public.room_seats;
create policy "Seats: holders renew own seat"
  on public.room_seats for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Server-side join authorization + capacity reservation (ARCHITECTURE §3/§4).
--
-- Returns one of:
--   'ok' | 'room_not_found' | 'room_closed' | 'room_full'
--   | 'invite_required' | 'invalid_invite'
--
-- SECURITY: definer function with a pinned search_path; only authenticated
-- users may execute it; it trusts NOTHING from the client except ids it
-- derives from the verified JWT (auth.uid()) or the invite token hash the
-- server computed from the raw link (invite ids never cross the wire).
-- ---------------------------------------------------------------------------
create or replace function public.reserve_room_seat(
  p_room_id uuid,
  p_invite_hash text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room record;
  v_capacity integer;
  v_active integer;
  v_invite_ok boolean := false;
begin
  if v_uid is null then
    return 'room_not_found';
  end if;

  -- Serialize concurrent joins for this room (closes the last-seat race).
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  -- Reap abandoned reservations before counting.
  delete from public.room_seats
  where room_id = p_room_id and expires_at <= now();

  select id, status, capacity into v_room
  from public.rooms where id = p_room_id;

  if not found then
    return 'room_not_found';
  end if;
  if v_room.status <> 'open' then
    return 'room_closed';
  end if;

  -- Private rooms require a live invite (valid, not revoked, not expired).
  -- The server passes the sha256 hash of the raw link token; raw tokens are
  -- never stored or transmitted to this function.
  if exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.visibility = 'private'
  ) then
    select exists (
      select 1 from public.room_invites i
      where i.token_hash = p_invite_hash
        and i.room_id = p_room_id
        and i.revoked_at is null
        and (i.expires_at is null or i.expires_at > now())
    ) into v_invite_ok;

    if not v_invite_ok then
      -- Rejoining members keep access without re-proving the invite.
      if not exists (
        select 1 from public.room_seats s
        where s.room_id = p_room_id and s.user_id = v_uid
      ) then
        return 'invite_required';
      end if;
    end if;
  end if;

  -- Seat TTL: with LiveKit absent (Stage 2), 15 minutes balances abandoned
  -- reservations against long focus sessions. Stage 3 converts this into a
  -- heartbeat tied to LiveKit disconnects (ARCHITECTURE §3 tradeoff).
  insert into public.room_seats (room_id, user_id, expires_at)
  values (p_room_id, v_uid, now() + interval '15 minutes')
  on conflict (room_id, user_id)
  do update set reserved_at = now(),
                expires_at = excluded.expires_at;

  v_capacity := v_room.capacity;
  select count(*) into v_active
  from public.room_seats where room_id = p_room_id;

  if v_active > v_capacity then
    -- We just took the seat; give it back so the room stays enforceable.
    delete from public.room_seats
    where room_id = p_room_id and user_id = v_uid;
    return 'room_full';
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.reserve_room_seat(uuid, text) from public, anon;
grant execute on function public.reserve_room_seat(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Invite lookup for the invite landing page (guests cannot read the invites
-- table; this definer function returns only the minimal room facts needed to
-- render the join card, plus a validity verdict).
-- ---------------------------------------------------------------------------
create or replace function public.get_room_invite(p_token_hash text)
returns table (
  room_id uuid,
  room_title text,
  room_description text,
  room_focus_tag text,
  room_capacity integer,
  room_status text,
  valid boolean,
  reason text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id,
    r.title,
    r.description,
    r.focus_tag,
    r.capacity,
    r.status,
    (
      i.revoked_at is null
      and (i.expires_at is null or i.expires_at > now())
      and r.status = 'open'
    ) as valid,
    case
      when i.id is null then 'invalid'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at is not null and i.expires_at <= now() then 'expired'
      when r.status <> 'open' then 'closed'
      else 'ok'
    end as reason
  from public.room_invites i
  join public.rooms r on r.id = i.room_id
  where i.token_hash = p_token_hash
  limit 1;
$$;

revoke execute on function public.get_room_invite(text) from public, anon;
grant execute on function public.get_room_invite(text) to authenticated;
