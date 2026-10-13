import type { RoomInvite } from "@/types/database";

/**
 * Server-side view model for invite rows.
 *
 * Time-dependent verdicts (expired vs active) are decided HERE, on the
 * server, so the client component renders pure, static props — no
 * `Date.now()` in render, no effects that setState (react-hooks purity).
 */

export interface InviteView {
  id: string;
  status: "active" | "revoked" | "expired";
  createdLabel: string;
  expiresLabel: string | null;
}

function dateLabel(iso: string): string {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toLocaleDateString();
}

export function toInviteViews(
  invites: RoomInvite[],
  /** Evaluated server-side at call time; tests pass a fixed clock. */
  now: number = Date.now(),
): { views: InviteView[]; activeCount: number } {
  let activeCount = 0;

  const views = invites.map((invite) => {
    const revoked = Boolean(invite.revoked_at);
    const expired =
      !revoked &&
      Boolean(invite.expires_at) &&
      Date.parse(invite.expires_at!) <= now;
    const status: InviteView["status"] = revoked
      ? "revoked"
      : expired
        ? "expired"
        : "active";
    if (status === "active") activeCount += 1;

    return {
      id: invite.id,
      status,
      createdLabel: dateLabel(invite.created_at),
      expiresLabel: invite.expires_at ? dateLabel(invite.expires_at) : null,
    };
  });

  return { views, activeCount };
}
