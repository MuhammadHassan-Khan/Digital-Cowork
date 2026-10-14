import "server-only";

import { RoomServiceClient } from "livekit-server-sdk";
import { env } from "@/lib/env";

/**
 * Server-side LiveKit configuration and admin helpers (Stage 3).
 *
 * Secrets (LIVEKIT_API_KEY / LIVEKIT_API_SECRET) are read only here, in a
 * server-only module — they can never reach the browser bundle (PRD §7).
 */

const WS_URL = /^wss?:\/\/\S+$/;

export interface LivekitConfig {
  /** Public WebSocket URL for the browser (wss://…). */
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
}

/** Full config when all three variables are present; null otherwise. */
export function getLivekitConfig(): LivekitConfig | null {
  const serverUrl = env.livekitUrl.trim();
  const apiKey = (process.env.LIVEKIT_API_KEY ?? "").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET ?? "").trim();
  if (!WS_URL.test(serverUrl) || !apiKey || !apiSecret) return null;
  return { serverUrl, apiKey, apiSecret };
}

/**
 * True only when URL + key + secret are all usable. Server components use
 * this to decide between the real session UI and a truthful
 * "not configured" notice (PRD §4 — never fake connected media).
 */
export function isLivekitConfigured(): boolean {
  return getLivekitConfig() !== null;
}

/** REST host for server-side admin calls (wss://x -> https://x). */
export function livekitRestHost(config: LivekitConfig): string {
  return config.serverUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

/**
 * Best-effort: ensure the LiveKit room row exists before the first join.
 * LiveKit also auto-creates rooms on join, so a failure here is non-fatal —
 * the caller still issues the token and the client surfaces any real
 * connection problem truthfully. Guarded by a timeout so a slow/unreachable
 * provider can never hang the token endpoint (FLOW §6: no aggressive stalls).
 */
export async function ensureLivekitRoom(
  config: LivekitConfig,
  roomName: string,
  emptyTimeoutSeconds = 600,
): Promise<void> {
  try {
    const client = new RoomServiceClient(
      livekitRestHost(config),
      config.apiKey,
      config.apiSecret,
    );
    await withTimeout(
      client.createRoom({ name: roomName, emptyTimeout: emptyTimeoutSeconds }),
      3_000,
    );
  } catch {
    // Best-effort only — see doc comment.
  }
}

/**
 * Best-effort removal of a participant from the live session (host removed
 * the member's seat). Failure is fine: the seat is already gone server-side,
 * the member's heartbeat then fails and their client disconnects on refresh
 * (defense in depth — the DB stays authoritative, ARCHITECTURE §3).
 */
export async function kickParticipant(
  config: LivekitConfig,
  roomName: string,
  identity: string,
): Promise<boolean> {
  try {
    const client = new RoomServiceClient(
      livekitRestHost(config),
      config.apiKey,
      config.apiSecret,
    );
    await withTimeout(client.removeParticipant(roomName, identity), 3_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort: disconnect everyone when the host closes the room.
 * Participants not connected to LiveKit are simply skipped.
 */
export async function endLivekitRoom(
  config: LivekitConfig,
  roomName: string,
): Promise<boolean> {
  try {
    const client = new RoomServiceClient(
      livekitRestHost(config),
      config.apiKey,
      config.apiSecret,
    );
    const participants = await withTimeout(
      client.listParticipants(roomName),
      3_000,
    );
    for (const participant of participants) {
      // Removed participants may already be gone — each call is guarded.
      try {
        await withTimeout(
          client.removeParticipant(roomName, participant.identity),
          3_000,
        );
      } catch {
        // Participant may have left between listing and removal.
      }
    }
    return true;
  } catch {
    // Room may not exist in LiveKit at all — nothing to end.
    return false;
  }
}

/** Reject after `ms` so provider outages degrade instead of hanging. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("livekit-timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
