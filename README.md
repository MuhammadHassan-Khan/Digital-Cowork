# Cowork — Virtual Coworking Platform (Zero-Budget MVP)

A browser-based virtual coworking platform: discover members by skills and
bio, find or create public/private rooms, and work alongside each other with
voice, video, ephemeral chat and screen sharing.

Built to the spec in the project docs (`PRD.md`, `ARCHITECTURE.md`,
`FLOW.md`, `IMPLEMENTATION_PLAN.md`): staged delivery, free tiers only,
truthful failure states, server-side authorization.

## Build status (updated per stage)

| Stage | Steps | Status |
|---|---|---|
| 1 — Foundation, auth, profiles, discovery | Steps 1–2 | ✅ Built & verified (typecheck/tests/lint/build) — live end-to-end test pending real Supabase credentials |
| 2 — Rooms + invites + capacity | Step 3 | ✅ Built & verified (typecheck/tests/lint/build) — live end-to-end test pending real Supabase credentials |
| 3 — LiveKit voice/video/chat | Step 4 | ⬜ Not started |
| 4 — Screen sharing (1 share → gated multi-share) | Step 5 | ⬜ Not started |
| 5 — Resilience + security hardening | Step 6 | ⬜ Not started |
| 6 — Final verification + report | Step 7 | ⬜ Not started |

## Tech stack

- **Next.js 16** (App Router, Turbopack, TypeScript) + **Tailwind CSS 4**
- **Supabase** (Auth + PostgreSQL with Row Level Security) via `@supabase/ssr`
- **LiveKit Cloud** (from Stage 3) for WebRTC voice/video/screen share
- **Vitest** for unit tests; ESLint flat config

## Quick start

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Then fill in values:

| Variable | Where it comes from | Required from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | Stage 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → anon/public key | Stage 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → service_role key (**server-only — never expose**) | Later stages |
| `LIVEKIT_URL` | cloud.livekit.io → project → Settings (`wss://…`) | Stage 3 |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (**server-only**) | Same page | Stage 3 |

Without Supabase keys the app still runs and shows a clear
"Supabase is not configured" notice on auth pages (no fake success).

### 3. Create the Supabase project & apply the schema

1. Create a free project at https://supabase.com/dashboard.
2. Open **SQL Editor** and run, **in order**:
   - [`supabase/migrations/0001_profiles.sql`](supabase/migrations/0001_profiles.sql)
   - [`supabase/migrations/0002_rooms.sql`](supabase/migrations/0002_rooms.sql)

   (or use `npx supabase db push` if you prefer the CLI).

Migration `0001` creates `public.profiles` with CHECK constraints that mirror
the app validation and RLS policies: everyone can read profiles (discovery),
only the owner can insert/update their own row, nobody can delete via the anon
key. Emails are never stored in `profiles` — they stay in `auth.users`.

Migration `0002` creates `rooms`, `room_invites` (sha256 token hashes only)
and `room_seats`, plus two `security definer` functions:
- `reserve_room_seat(room, invite_hash)` — the **only** join path: verifies
  session, room state and invites, serializes concurrent joins with a
  per-room advisory lock, enforces capacity, and expires abandoned seats.
- `get_room_invite(token_hash)` — invite landing-page lookup for non-hosts.

### 4. (Recommended) Email confirmation settings

For local demos the fastest path is **Authentication → Providers → Email →
turn OFF "Confirm email"**, so signups get a session immediately.

If you keep confirmation ON (production-like), configure
**Authentication → URL Configuration**:
- Site URL: `http://localhost:3000`
- Redirect URLs: add `http://localhost:3000/auth/confirm`
- Email template (Confirm signup) link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding`

The app handles both link shapes (`token_hash` and PKCE `code`, including
`?code=` links landing on the homepage).

### 5. Run

```bash
npm run dev        # http://localhost:3000
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route typegen + `tsc --noEmit` |
| `npm test` | Vitest unit tests (no credentials needed) |

## Architecture notes

### Stage 1
- **Route protection:** `src/proxy.ts` (Next 16's middleware) refreshes the
  Supabase session and enforces coarse access with `resolveRouteGuard` —
  a pure, unit-tested authorization matrix (`src/lib/auth/route-guard.ts`).
  Fine-grained authorization always re-verifies inside Server Actions /
  route handlers; the proxy is never the only check.
- **Data Access Layer:** server code resolves the caller via
  `supabase.auth.getUser()` (`src/lib/auth/session.ts`,
  `src/lib/data/profiles.ts`). Client-supplied ids are never trusted.
- **Validation:** Zod schemas in `src/lib/validation/` mirror the SQL CHECK
  constraints, so client feedback and database enforcement agree.
- **RLS first:** all reads/writes run through the user's own session; the
  service-role key is not used anywhere yet.
- **Truthful states:** missing config, DB errors, permission failures and
  failed searches render explicit notices — never silent empties or fakes.

### Stage 2 (rooms, invites, capacity)
- **One join path:** every seat comes from `reserve_room_seat`
  (`supabase/migrations/0002_rooms.sql`) — session-derived user id, room
  state, invite validity and capacity (2–10, PRD cap) checked in the
  database under a per-room advisory lock, so simultaneous join attempts
  for the last seat resolve to exactly one winner.
- **Seats expire:** reservations carry a 15-minute TTL; the open room page
  renews every 5 minutes (`SeatHeartbeat`, replaceable by LiveKit presence
  in Stage 3). A crashed browser cannot block a room.
- **Invites are capabilities:** 32 random bytes per link, shown once, stored
  only as sha256 (`room_invites.token_hash`), revocable, optionally expiring,
  max 5 active per room. Guests resolve them through `get_room_invite`
  (RLS keeps the table host-only).
- **Host controls:** close room, remove a participant, revoke invites —
  checked explicitly in actions for clear messages, enforced for real by RLS.

## Known limitations (by design, per PRD)

- In-room chat will be ephemeral (LiveKit data packets); **no chat history**,
  recordings, DMs, payments or AI features in the MVP.
- Rooms cap at **10 participants**, enforced server-side by the
  `reserve_room_seat` RPC (Stage 2).
- Screen share: **one reliable share is the baseline**; 2–5 simultaneous
  shares are an experimental, test-gated stretch target (Stage 4).
- Free-tier limits are real: LiveKit Build quotas and Supabase Free quotas are
  hard caps — see `ZERO_BUDGET_CAPABILITIES.md`. Monitor dashboards before demos.
- Vercel Hobby is personal/non-commercial; verify terms before any deployment.

## Manual test checklist (Stage 1)

Run with two different browsers/profiles once credentials are in place:

1. Sign up → confirmation (or direct onboarding if confirmations off).
2. Onboarding creates profile → lands in Discover.
3. Second account appears in first account's Discover; search by name/bio/skill
   and level filter work; own profile is excluded.
4. `/profile/[id]` shows public fields only — no email anywhere.
5. Editing another profile is impossible (URL `/profile/edit` only edits you;
   RLS blocks cross-user writes — verify by attempting a crafted request).
6. Signed-out visit to `/discover` → redirected to `/login?next=…` → after
   sign-in returns to the original destination.
7. With keys removed: app shows the configuration notice, never fake data.

## Manual test checklist (Stage 2 — rooms, invites, capacity)

With **two browsers/profiles** signed in as two different members:

1. **Create:** B → Rooms → Create room (public, capacity 2) → lands on the
   room page; A sees it listed at `/rooms` with occupancy `0/2`.
2. **Join:** B takes a seat (`1/2`), A joins (`2/2`). A third browser C now
   sees **“This room is full”** — the message comes from the database RPC,
   not the UI. B clicks *Leave* → C can join immediately.
3. **Host controls:** B (host) sees *Invite links* and *Close room*; A does
   not. B removing A frees A's seat; A cannot remove B (crafted request hits
   RLS and the action's host check).
4. **Private room:** create a private room → it never appears in `/rooms`;
   A opening its URL directly gets a 404 (RLS hides it). B creates an invite
   link (shown once, copyable), A opens `/invite/<token>` → *Join this room*
   → seated. Revoking the link makes the same URL say it was revoked;
   an expired link says expired; a garbage token says not valid.
5. **Close:** B closes the room → it leaves the directory; a member not yet
   seated gets “room is closed” on join; the room page shows the closed state.
6. **Capacity race:** open the same near-full room in 3+ browsers and join
   simultaneously — occupancy never exceeds capacity (advisory lock).
7. **Heartbeat:** with the room page open >15 min, the seat stays held
   (renews every 5 min); closing the tab frees it after the TTL.
