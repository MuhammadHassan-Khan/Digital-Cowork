import { describe, expect, it } from "vitest";
import {
  authorizeHostAction,
  HOST_GATE_MESSAGES,
} from "@/lib/rooms/host-gate";

const HOST = "host-user-id";
const CALLER = "other-user-id";

function gate(overrides: Partial<Parameters<typeof authorizeHostAction>[0]>) {
  return authorizeHostAction({
    callerId: CALLER,
    roomFound: true,
    roomHostId: HOST,
    action: "remove",
    ...overrides,
  });
}

describe("authorizeHostAction", () => {
  it("allows the host", () => {
    expect(gate({ callerId: HOST })).toEqual({ ok: true });
  });

  it("refuses non-hosts with the action-specific message", () => {
    const decision = gate({ callerId: CALLER, action: "remove" });
    expect(decision).toEqual({
      ok: false,
      error: "Only the host can remove participants.",
    });
  });

  it("answers honestly for a missing/invisible room before role checks", () => {
    const decision = gate({ roomFound: false, roomHostId: null });
    expect(decision).toMatchObject({ ok: false });
    if (!decision.ok) expect(decision.error).toBe("That room no longer exists.");
  });

  it("treats a null host id as not-found (defensive)", () => {
    expect(gate({ roomHostId: null })).toMatchObject({ ok: false });
  });

  it("never confuses caller with host when ids merely look similar", () => {
    expect(gate({ callerId: `${HOST}-evil`, roomHostId: HOST })).toMatchObject({
      ok: false,
    });
  });

  it("provides a message for every host-only action", () => {
    expect(Object.keys(HOST_GATE_MESSAGES).sort()).toEqual([
      "close",
      "invite",
      "remove",
      "revoke",
    ]);
    for (const message of Object.values(HOST_GATE_MESSAGES)) {
      expect(message).toMatch(/^Only the host can /);
    }
  });

  it("keeps the production messages the actions relied on before", () => {
    // Regression guard: UI copy and tests stay in sync with actions/rooms.ts
    expect(HOST_GATE_MESSAGES.close).toBe(
      "Only the host can close this room.",
    );
    expect(HOST_GATE_MESSAGES.invite).toBe(
      "Only the host can create invite links.",
    );
    expect(HOST_GATE_MESSAGES.revoke).toBe(
      "Only the host can revoke invite links.",
    );
  });
});
