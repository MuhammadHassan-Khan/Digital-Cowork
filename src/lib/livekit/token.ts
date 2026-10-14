import { AccessToken } from "livekit-server-sdk";

/**
 * LiveKit access-token minting (Step 4 / ARCHITECTURE §4).
 *
 * Pure module: credentials are passed in by the caller (the token route
 * reads them from server-only config), so this file stays unit-testable and
 * carries no `server-only` import — it is never imported by client code.
 *
 * Token restrictions (PRD §7 "restrict token identity, room, permissions"):
 *  - identity = the verified user's id (set server-side, never from input)
 *  - grants only this ONE room, join + subscribe + publish + data
 *  - no roomAdmin / roomCreate / recording permissions
 *  - short TTL so leaked tokens age out quickly
 */

/** Short-lived by design; reconnects re-request a fresh token. */
export const LIVEKIT_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export interface RoomTokenInput {
  apiKey: string;
  apiSecret: string;
  /** Verified user id from the session — the participant identity. */
  identity: string;
  /** Display name shown on the participant tile. */
  name: string;
  /** Database room id — the LiveKit room this token may join (only this). */
  roomId: string;
  ttlSeconds?: number;
}

export async function createRoomToken(input: RoomTokenInput): Promise<string> {
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: input.identity,
    name: input.name,
    ttl: input.ttlSeconds ?? LIVEKIT_TOKEN_TTL_SECONDS,
  });

  token.addGrant({
    room: input.roomId,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true, // microphone + camera tracks (screen share in Stage 4)
    canPublishData: true, // ephemeral in-room chat packets (FLOW §5.3)
  });

  return token.toJwt();
}
