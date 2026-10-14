import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/profile-search";
import { getMySeat, getProfileName, loadRoom } from "@/lib/data/rooms";
import { authorizeTokenRequest } from "@/lib/livekit/authorize";
import { tokenRequestLimiter } from "@/lib/livekit/rate-limit";
import {
  ensureLivekitRoom,
  getLivekitConfig,
  isLivekitConfigured,
} from "@/lib/livekit/server";
import { createRoomToken } from "@/lib/livekit/token";

/**
 * POST /api/rooms/[id]/token — issues a short-lived, room-scoped LiveKit
 * access token (Step 4: "Create authenticated server-side token endpoint").
 *
 * Trust boundary (ARCHITECTURE §4, CODING_PROMPTS Prompt 4):
 *  - verifies the Supabase session itself (`getCurrentUser` → getUser(),
 *    not a client claim) — `/api/*` is excluded from the proxy;
 *  - re-runs room authorization: visibility via RLS, an ACTIVE seat
 *    (capacity reservation from Stage 2) and open status;
 *  - identity comes from the verified user, room from the URL, permissions
 *    restricted inside `createRoomToken` — nothing from the body is trusted;
 *  - rate limited per user; every failure returns a truthful JSON error.
 *
 * The request body is ignored on purpose.
 */

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const configured = isLivekitConfigured();
  const user = await getCurrentUser();

  // Rate limit first among authenticated checks — cheap rejection under abuse.
  const rateLimited = user
    ? !tokenRequestLimiter.allow(`token:${user.id}`)
    : false;

  // Room + seat lookups only for authenticated, non-rate-limited callers.
  // loadRoom runs under RLS: invisible rooms answer like missing ones.
  const roomResult =
    user && !rateLimited && isUuid(id) ? await loadRoom(id) : null;
  const room = roomResult?.status === "ok" ? roomResult.room : null;
  const seat =
    user && room && !rateLimited ? await getMySeat(id, user.id) : null;

  const decision = authorizeTokenRequest({
    configured,
    authed: Boolean(user),
    rateLimited,
    roomFound: Boolean(room),
    hasSeat: Boolean(seat),
    roomOpen: room?.status === "open",
  });

  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  // From here: configured + authed + not rate-limited + room + seat + open.
  const config = getLivekitConfig();
  if (!config || !user || !room) {
    // Unreachable unless configuration changed mid-request; stay truthful.
    return NextResponse.json(
      { error: "Media service is not configured." },
      { status: 503 },
    );
  }

  const displayName = (await getProfileName(user.id)) ?? "Member";

  // Best-effort room creation (idempotent; join also auto-creates). Never
  // blocks issuance for more than ~3s — see ensureLivekitRoom.
  await ensureLivekitRoom(config, room.id);

  const token = await createRoomToken({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    identity: user.id,
    name: displayName,
    roomId: room.id,
  });

  return NextResponse.json({ token, roomId: room.id });
}
