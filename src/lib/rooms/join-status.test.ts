import { describe, expect, it } from "vitest";
import {
  inviteReasonMessage,
  JOIN_STATUS_MESSAGES,
  JOIN_STATUSES,
  joinStatusMessage,
  toJoinStatus,
} from "@/lib/rooms/join-status";

describe("toJoinStatus", () => {
  it("passes through known RPC results", () => {
    expect(toJoinStatus("ok")).toBe("ok");
    expect(toJoinStatus("room_full")).toBe("room_full");
    expect(toJoinStatus("invite_required")).toBe("invite_required");
  });

  it("narrows unknown, null and garbage to 'unknown'", () => {
    expect(toJoinStatus("surprise")).toBe("unknown");
    expect(toJoinStatus(null)).toBe("unknown");
    expect(toJoinStatus(undefined)).toBe("unknown");
    expect(toJoinStatus(7)).toBe("unknown");
  });
});

describe("JOIN_STATUS_MESSAGES", () => {
  it("has a non-empty, truthful message for every status", () => {
    for (const status of JOIN_STATUSES) {
      const message = joinStatusMessage(status);
      expect(message.length).toBeGreaterThan(0);
      // No placeholder/fake-success language allowed (PRD §4).
      expect(message).not.toMatch(/lorem|todo|coming soon/i);
    }
  });

  it("never reports success for a failure status", () => {
    expect(joinStatusMessage("room_full")).toMatch(/full/i);
    expect(joinStatusMessage("room_closed")).toMatch(/closed/i);
    expect(joinStatusMessage("invite_required")).toMatch(/invite/i);
  });
});

describe("inviteReasonMessage", () => {
  it("explains revoked and expired links distinctly", () => {
    expect(inviteReasonMessage("revoked")).toMatch(/revoked/i);
    expect(inviteReasonMessage("expired")).toMatch(/expired/i);
    expect(inviteReasonMessage("closed")).toMatch(/closed/i);
  });

  it("falls back honestly for unexpected reasons", () => {
    expect(inviteReasonMessage("something-new")).toBe(
      JOIN_STATUS_MESSAGES.unknown,
    );
    expect(inviteReasonMessage("")).toBe(JOIN_STATUS_MESSAGES.unknown);
  });
});
