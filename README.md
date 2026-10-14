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
| 3 — LiveKit voice/video/chat | Step 4 | ✅ Built & verified (typecheck/tests/lint/build) — live end-to-end test pending real Supabase + LiveKit credentials |
| 4 — Screen sharing (1 share → gated multi-share) | Step 5 | ✅ Built & verified (typecheck/tests/lint/build) — live multi-share validation pending real credentials + devices |
| 5 — Resilience + security hardening | Step 6 | ✅ Built & verified (typecheck/tests/lint/build) |
| 6 — Final verification + report | Step 7 | ✅ Verified — see [Final verification](#final-verification-stage-6); live multi-user tests pending credentials |

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
| `NEXT_PUBLIC_LIVEKIT_URL` | cloud.livekit.io → project → Settings/Keys (`wss://…`) | Stage 3 |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (**server-only**) | Same page | Stage 3 |
| `NEXT_PUBLIC_ENABLE_MULTI_SHARE` | Leave blank for the reliable single-share baseline; `true` enables experimental 2–5 simultaneous shares | Stage 4 (optional) |

Without Supabase keys the app still runs and shows a clear
"Supabase is not configured" notice on auth pages (no fake success).
Without LiveKit keys, seated members see a truthful
"Media service not configured" notice on the room page — no fake session.

### 3. Create the Supabase project & apply the schema

1. Create a free project at https://supabase.com/dashboard.
2. Open **SQL Editor** and run, **in order**:
   - [`supabase/migrations/0001_profiles.sql`](supabase/migrations/0001_profiles.sql)
   - [`supabase/migrations/0002_rooms.sql`](supabase/migrations/0002_rooms.sql)
   - [`supabase/migrations/0003_hardening.sql`](supabase/migrations/0003_hardening.sql)

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

Migration `0003` applies the Stage 5 RLS review fixes: direct client writes
to `room_seats` are revoked (seat creation can only happen through the
advisory-locked RPC; the heartbeat keeps a column-level `expires_at`
grant), and `room_invites` updates re-check host ownership on the new row
state.

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

### 5. Configure LiveKit (Stage 3: voice/video/chat)

1. Create a free account at https://cloud.livekit.io and a project.
2. Open **Settings → Keys** and copy the three values into `.env.local`:
   - **Project URL / WebSocket URL** → `NEXT_PUBLIC_LIVEKIT_URL` (`wss://…`)
   - **API Key** → `LIVEKIT_API_KEY`
   - **API Secret** → `LIVEKIT_API_SECRET`

Free-tier quotas are real (participant-minutes/participant counts) — see
`ZERO_BUDGET_CAPABILITIES.md` and check the dashboard before demos. All
three values are required together; partial configuration still shows the
"not configured" notice.

### 6. Run

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
  renews every 60 seconds (`SeatHeartbeat`) — fast enough for host actions
  (close/remove) to propagate within one beat. A crashed browser cannot
  block a room.
- **Invites are capabilities:** 32 random bytes per link, shown once, stored
  only as sha256 (`room_invites.token_hash`), revocable, optionally expiring,
  max 5 active per room. Guests resolve them through `get_room_invite`
  (RLS keeps the table host-only).
- **Host controls:** close room, remove a participant, revoke invites —
  checked explicitly in actions for clear messages, enforced for real by RLS.

### Stage 3 (LiveKit voice/video/chat)
- **Token endpoint:** `POST /api/rooms/[id]/token` (`src/app/api/…`) is the
  only way into the media room. It self-authorizes (`/api/*` skips the
  proxy): verifies the Supabase session with `getUser()`, re-checks RLS
  visibility, an **active seat** (the Stage 2 capacity gate) and open room
  status, rate-limits (20/min per user), then mints a **1-hour token**
  bound to identity = user id, grants = this one room only, join +
  subscribe + publish + data — no admin/create/record powers
  (`src/lib/livekit/token.ts`, unit-tested with the official verifier).
- **Pure authorization core:** the endpoint's decision matrix
  (`src/lib/livekit/authorize.ts`) and sliding-window limiter
  (`src/lib/livekit/rate-limit.ts`) are dependency-free and covered by
  tests (503/401/429/404/403/409 paths).
- **Session UI:** `RoomSession` requests a token, connects with
  `livekit-client` via `@livekit/components-react`, joins **without
  mic/camera** (permissions requested only on explicit toggles), and
  renders participant tiles, connection state, toggles and ephemeral chat
  (LiveKit data packets — `ChatPanel` keeps messages in memory and says
  so; nothing is persisted). Permission denial, unreachable server, closed
  room and missing keys all render truthful notices — never fake media.
- **Presence reconciliation:** the seat heartbeat (60 s) stays the single
  seat-truth mechanism. `renewSeatAction` now answers `ok: false` for
  closed rooms; on any refusal the page refreshes, the session unmounts
  and LiveKit disconnects. Host close/remove additionally kick participants
  out of LiveKit **best-effort** via `RoomServiceClient`
  (`src/lib/livekit/server.ts`, 3 s timeouts) — if that call fails, the
  heartbeat fallback still ends the session within one beat.
- **Server-only secrets:** `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` are read
  exclusively in `src/lib/livekit/server.ts` (`server-only`), so they can
  never reach the browser bundle.

### Stage 4 (screen sharing)
- **One reliable baseline:** by default exactly ONE screen share is
  subscribed and rendered at a time. When several people share, the viewer
  picks which one to watch (chips), and every non-selected share is
  **unsubscribed** (`RemoteTrackPublication.setSubscribed(false)`) so
  viewers never pay bandwidth for screens they are not watching
  (PRD §5 "do not force every viewer to render all screen feeds").
  Policy lives in a pure, unit-tested module
  (`src/lib/livekit/screen-share.ts`).
- **Experimental multi-share:** gated by `NEXT_PUBLIC_ENABLE_MULTI_SHARE=true`
  — renders up to 5 shares (PRD stretch cap) in a labeled "Experimental
  multi-share" grid, still honoring the cap and viewer selection. **It is
  implemented, not validated** — no claim is made until real-device tests
  are run and documented (PRD §5).
- **Controls & honest states:** a *Share screen / Stop sharing* toggle
  joins mic/camera; dismissing the picker or permission denial shows
  "nothing was shared — voice, camera and chat keep working"; stopping via
  the browser's native control is acknowledged through the
  `LocalTrackUnpublished` event so the UI never claims a dead share is
  live. Every stage tile is captioned with WHO is sharing (PRD §4).
- **Reasonable capture/quality:** capture passes `audio: false` (no system
  audio) + `contentHint: detail` and relies on LiveKit's default 1080p cap
  (no forced maximum resolution); the room runs with `adaptiveStream`
  (viewer-side adaptive quality) and `dynacast` (skip sending layers nobody
  subscribes to) — PRD §5.

### Stage 5 (resilience + security hardening)
- **RLS review found and fixed two real holes** (`0003_hardening.sql`):
  1. `room_seats` had default INSERT/UPDATE table privileges, so a hostile
     client could bypass `reserve_room_seat` — inserting seats past
     capacity / into private or closed rooms, or moving its seat's
     `room_id` elsewhere. Direct seat writes are now **revoked**; seat
     creation happens only in the advisory-locked RPC, and the heartbeat
     keeps a column-level `update(expires_at)` grant.
  2. The `room_invites` UPDATE policy lacked a `WITH CHECK`, allowing an
     invite to be moved into another host's room — now re-checked.
- **Reviewed as sound:** profiles (public read, self-write, no delete,
  no emails), rooms (visibility-scoped read, host write, capacity/status
  CHECK constraints), invites (host-only table, guest lookup via
  security-definer RPC with hash checks), RPCs (revoked from
  public/anon, granted to authenticated). The service-role key is unused.
- **Host-only actions** route through one pure, tested authorization gate
  (`src/lib/rooms/host-gate.ts`) with consistent messages; RLS remains
  the enforcement boundary underneath every action check.
- **Rate limits** (PRD §7): media tokens 20/min/user, invite creation
  10/min/user — in-memory, per server process (documented limitation;
  move to a shared store if you ever run multiple instances).
- **Error matrix (FLOW §6) — every failure is a truthful state:**
  missing Supabase/LiveKit keys → configuration notice; permission denied
  → "…text chat still works"; reconnect → status pill + **Rejoin issues a
  fresh token** (expired-token recovery); quota/429 → "temporarily
  unavailable" with **no automatic retry**; room full/closed/invite
  invalid → messages from the server, never the UI; heartbeat expiry →
  seat released, rejoin allowed.
- **Static security tests** (`src/lib/security/static-security.test.ts`):
  only `NEXT_PUBLIC_*` env vars outside `server-only` modules, zero
  console output anywhere in `src/` (log privacy), secrets module guard,
  `.env*` git-ignored.
- **Moderation (PRD §7):** the documented manual process is — host
  removes a member (instant LiveKit kick), host revokes invite links,
  host closes the room (ends everyone's session); profiles/rooms can only
  be edited by their owner through RLS. Report abuse to the operator of
  the deployment running this code.

## Known limitations (by design, per PRD)

- In-room chat will be ephemeral (LiveKit data packets); **no chat history**,
  recordings, DMs, payments or AI features in the MVP.
- Rooms cap at **10 participants**, enforced server-side by the
  `reserve_room_seat` RPC (Stage 2).
- Screen share: **one reliable share is the baseline**; 2–5 simultaneous
  shares are an experimental, test-gated stretch target (Stage 4) —
  implemented behind `NEXT_PUBLIC_ENABLE_MULTI_SHARE` but **not validated
  until documented manual tests are run**.
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
   (renews every minute); closing the tab frees it after the TTL.

## Manual test checklist (Stage 3 — voice/video/chat)

With **Supabase + LiveKit keys configured** and two browsers signed in:

1. **Config state:** remove the LiveKit keys → a seated member sees
   “Media service not configured” (with the exact variable names), never a
   fake session. Restore them and the live session appears.
2. **Token authorization:** signed-out `POST /api/rooms/<id>/token` → 401;
   signed-in without a seat → 403; room id that is not yours/private → 404;
   closed room → 409; >20 requests/min → 429. Responses are JSON errors
   with truthful messages.
3. **Join:** both browsers take seats → each shows “Connecting…” then
   “Connected”, the other participant's tile appears, count reads 2 in room.
4. **Mic/camera:** toggles start **off**. Allow permission → audio/video
   flows to the other browser. Deny permission → the honest
   “permission was denied … text chat still works” notice appears.
5. **Chat:** messages appear in both browsers instantly; reload → history
   is gone (ephemeral by design, no DB rows).
6. **Host controls:** host closes the room → members’ pages refresh to the
   closed state and the LiveKit session ends (worst case within ~1 min);
   host removing a member kicks them out of the live session too.
7. **Reconnect:** kill one browser's network → “Reconnecting…”, then
   “Disconnected” with a truthful notice; *Rejoin* issues a fresh token.
8. **Leave:** *Leave* frees the seat; the other browser's participant count
   drops after LiveKit reports the disconnect.

## Manual test checklist (Stage 4 — screen sharing)

With credentials configured and two browsers signed in (baseline, gate OFF):

1. **Share:** A clicks *Share screen* → picks a window → stage appears for
   BOTH browsers with the caption “A is sharing their screen”; A's button
   reads *Stop sharing*.
2. **Denial/cancel:** click share and dismiss the picker → truthful
   “permission was denied or the picker was closed — nothing was shared”
   notice; voice/camera/chat unaffected.
3. **Browser stop:** A stops via the browser's own *Stop sharing* bar →
   A's UI acknowledges the stop and the stage disappears for everyone.
4. **Viewer choice:** B shares too → both stages are listed as chips
   (“choose which to view”); only the selected share is subscribed —
   switching chips swaps the rendered screen.
5. **Standalone stop:** A clicks *Stop sharing* → same clean removal; no
   orphan tiles, no fake “live” state.
6. **Reconnect:** network blip while sharing → after Rejoin the share is
   gone (unpublished) with truthful states — sharing must be restarted
   manually.

Multi-share (**experimental**, `NEXT_PUBLIC_ENABLE_MULTI_SHARE=true` —
record devices/network and results; do NOT claim validated until done):

7. Two simultaneous shares render together in the labeled grid; three to
   five follow the same path; beyond five the cap notice appears and chips
   swap shares in/out.

## Manual test checklist (Stage 5 — resilience + security)

1. **Seat bypass is closed (needs migrated DB):** from a signed-in
   browser console, `fetch('/rest/v1/room_seats',{method:'POST',headers:{...},body:JSON.stringify({room_id:'…',user_id:'<self>'})})`
   → **permission denied**; same for PATCHing your seat's `room_id`.
   Seats only ever appear via *Join* (the RPC).
2. **Host checks:** as a non-host, submit crafted close/remove/revoke
   server-action requests → consistent “Only the host can …” messages
   (and RLS refuses the write regardless).
3. **Rate limits:** 11th invite within a minute → truthful rate-limit
   message; >20 token POSTs in a minute → `429` JSON.
4. **Expired-token recovery:** in the live session, go offline →
   *Disconnected* notice → online → *Rejoin* → a **fresh token** is
   fetched (no stuck loop reusing the old one).
5. **Quota error copy:** with the LiveKit plan's quota exhausted (check
   dashboard), joining shows “temporarily unavailable — try again in a
   few minutes”, with **no** automatic retry storm.
6. **Host-close propagation:** close a room with a member connected →
   their session ends and the page shows the closed state within ~1 min.
7. **Static security tests:** `npm test` — env-exposure/console/gitignore
   scans pass (they fail CI if a secret or log slips in later).
8. **No secrets in logs:** complete a signup + room flow; the dev server
   output contains no emails, tokens or keys (the app never calls
   `console.*`).

## Final verification (Stage 6)

Exact commands and results, run on a clean checkout (Node v24, Windows):

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ clean (route typegen + `tsc --noEmit`) |
| `npm test` | ✅ **121/121** tests, 15 files |
| `npm run lint` | ✅ clean |
| `npm run build` | ✅ 13 routes compiled, exit 0 |
| `npm audit --omit=dev` | ✅ **0 production vulnerabilities** |
| `npm audit` | ⚠️ 5 high, **dev-only** (ESLint chain: `fast-glob`/`braces` family — not shipped, force-fix would break tooling) |
| Live HTTP (localhost:3000) | ✅ `/` 200 · `/rooms` 307→`/login` · token endpoint `503` with truthful config message |

### PRD §4 acceptance status

| Criterion | Status |
|---|---|
| Signup/sign-in with real credentials | Implemented — **live run pending credentials** |
| Profiles + discovery | Implemented — live run pending credentials |
| Public/private rooms, invites, join/leave | Implemented (RPC + RLS) — live run pending |
| Max 10 enforced server-side | ✅ DB CHECK + advisory-locked RPC + seat writes revoked (`0003`) |
| Real voice/video/chat/screen share | Implemented (Stages 3–4) — **media paths pending LiveKit keys** |
| Share controls show who shares; sharer can stop | Implemented (captions, stop control, browser-stop detection) |
| Private rooms hidden + bypass rejected | Implemented (RLS + revoked direct seat writes) — needs live DB to demonstrate |
| Chat works when mic/camera denied | Implemented by design (join without media) — pending live test |
| Reconnect/permission/quota/missing-config → clear state | ✅ states implemented; config + rate-limit paths live-verified |
| Tests/typecheck/lint/build pass; manual tests documented | ✅ this section + checklists above |

### PRD §5 (screen share)

- Baseline single share, viewer-selectable tracks, unsubscribed non-chosen
  feeds, adaptive quality: **implemented and unit-tested** (live pending).
- 2–5 simultaneous shares: **implemented behind the gate, explicitly NOT
  validated** — no real-device/network test has been run.

### Not verified (honest list)

- Any database or media path end-to-end (no Supabase/LiveKit credentials
  have been provided): signup email flow, concurrent-join race against a
  live PostgREST, RLS behavior in the real API, voice/video/chat/screen
  share, host kicks over LiveKit, quota exhaustion, the 429 rate-limit
  responses (needs an authenticated session), the staged 2→5→10 room and
  1→5 share tests on real devices.
- No deployment exists — nothing has been published anywhere.
