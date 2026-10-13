import { describe, expect, it } from "vitest";
import { toInviteViews } from "@/lib/rooms/invite-views";
import type { RoomInvite } from "@/types/database";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");

function invite(overrides: Partial<RoomInvite> = {}): RoomInvite {
  return {
    id: "inv-1",
    room_id: "room-1",
    created_by: "user-1",
    expires_at: null,
    revoked_at: null,
    created_at: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("toInviteViews", () => {
  it("marks live, revoked and expired invites correctly", () => {
    const { views, activeCount } = toInviteViews(
      [
        invite({ id: "live" }),
        invite({ id: "revoked", revoked_at: "2026-06-10T00:00:00.000Z" }),
        invite({ id: "expired", expires_at: "2026-06-14T00:00:00.000Z" }),
        invite({ id: "future", expires_at: "2026-07-01T00:00:00.000Z" }),
      ],
      NOW,
    );

    expect(views.map((v) => [v.id, v.status])).toEqual([
      ["live", "active"],
      ["revoked", "revoked"],
      ["expired", "expired"],
      ["future", "active"],
    ]);
    expect(activeCount).toBe(2);
  });

  it("treats a revoked-but-unexpired invite as revoked, not active", () => {
    const { activeCount } = toInviteViews(
      [
        invite({
          revoked_at: "2026-06-10T00:00:00.000Z",
          expires_at: "2026-07-01T00:00:00.000Z",
        }),
      ],
      NOW,
    );
    expect(activeCount).toBe(0);
  });

  it("counts an invite expiring exactly now as expired", () => {
    const { views, activeCount } = toInviteViews(
      [invite({ expires_at: new Date(NOW).toISOString() })],
      NOW,
    );
    expect(views[0]!.status).toBe("expired");
    expect(activeCount).toBe(0);
  });

  it("formats created/expiry labels and leaves absent expiry empty", () => {
    const { views } = toInviteViews(
      [invite({ expires_at: "2026-07-01T00:00:00.000Z" })],
      NOW,
    );
    expect(views[0]!.createdLabel.length).toBeGreaterThan(0);
    expect(views[0]!.expiresLabel!.length).toBeGreaterThan(0);

    const noExpiry = toInviteViews([invite()], NOW);
    expect(noExpiry.views[0]!.expiresLabel).toBeNull();
  });
});
