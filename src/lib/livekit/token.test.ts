import { describe, expect, it } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import {
  createRoomToken,
  LIVEKIT_TOKEN_TTL_SECONDS,
} from "@/lib/livekit/token";

const KEY = "APItestkey0123456789";
const SECRET = "unit-test-secret-not-a-real-livekit-secret";
const ROOM = "11111111-2222-3333-4444-555555555555";
const USER = "99999999-8888-7777-6666-555555555555";

describe("createRoomToken", () => {
  it("mints a verifiable token bound to identity, name and room", async () => {
    const jwt = await createRoomToken({
      apiKey: KEY,
      apiSecret: SECRET,
      identity: USER,
      name: "Ada Lovelace",
      roomId: ROOM,
    });

    const claims = await new TokenVerifier(KEY, SECRET).verify(jwt);

    expect(claims.sub).toBe(USER);
    expect(claims.name).toBe("Ada Lovelace");
    expect(claims.video?.room).toBe(ROOM);
    expect(claims.video?.roomJoin).toBe(true);
  });

  it("grants exactly join/subscribe/publish/data — no admin powers", async () => {
    const jwt = await createRoomToken({
      apiKey: KEY,
      apiSecret: SECRET,
      identity: USER,
      name: "Member",
      roomId: ROOM,
    });

    const claims = await new TokenVerifier(KEY, SECRET).verify(jwt);
    const video = claims.video;

    expect(video?.canSubscribe).toBe(true);
    expect(video?.canPublish).toBe(true); // mic/camera (screen share in Stage 4)
    expect(video?.canPublishData).toBe(true); // ephemeral chat packets
    expect(video?.roomAdmin).toBeFalsy();
    expect(video?.roomCreate).toBeFalsy();
    expect(video?.roomRecord).toBeFalsy();
    expect(video?.hidden).toBeFalsy();
  });

  it("expires after the requested TTL", async () => {
    const before = Math.floor(Date.now() / 1000);
    const jwt = await createRoomToken({
      apiKey: KEY,
      apiSecret: SECRET,
      identity: USER,
      name: "Member",
      roomId: ROOM,
      ttlSeconds: 600,
    });
    const after = Math.floor(Date.now() / 1000);

    const claims = await new TokenVerifier(KEY, SECRET).verify(jwt);
    // exp lands exactly `ttl` seconds after issuance (verifier omits iat).
    expect(claims.exp ?? 0).toBeGreaterThanOrEqual(before + 600);
    expect(claims.exp ?? 0).toBeLessThanOrEqual(after + 600);
  });

  it("uses a short-lived default TTL (never a permanent token)", () => {
    expect(LIVEKIT_TOKEN_TTL_SECONDS).toBeGreaterThanOrEqual(300);
    expect(LIVEKIT_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(3_600);
  });

  it("produces different tokens for different rooms and users", async () => {
    const base = { apiKey: KEY, apiSecret: SECRET, name: "Member" };
    const a = await createRoomToken({ ...base, identity: USER, roomId: ROOM });
    const b = await createRoomToken({
      ...base,
      identity: USER,
      roomId: "22222222-3333-4444-5555-666666666666",
    });
    const c = await createRoomToken({
      ...base,
      identity: "33333333-4444-5555-6666-777777777777",
      roomId: ROOM,
    });

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("rejects tokens signed with a different secret", async () => {
    const jwt = await createRoomToken({
      apiKey: KEY,
      apiSecret: SECRET,
      identity: USER,
      name: "Member",
      roomId: ROOM,
    });

    await expect(
      new TokenVerifier(KEY, "some-other-secret").verify(jwt),
    ).rejects.toThrow();
  });
});
