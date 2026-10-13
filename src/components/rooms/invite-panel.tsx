"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInviteAction, revokeInviteAction } from "@/lib/actions/rooms";
import type { InviteView } from "@/lib/rooms/invite-views";
import { MAX_ACTIVE_INVITES_PER_ROOM } from "@/lib/validation/room";

/**
 * Host-only invite management.
 *
 * The raw token is returned by the server EXACTLY ONCE per creation — the
 * panel shows the full link for copying, then it is gone forever (only the
 * sha256 hash persists in the database). Invite statuses and the origin are
 * precomputed server-side so this component renders purely.
 */
export function InvitePanel({
  roomId,
  origin,
  invites,
  activeCount,
  invitesLoadFailed,
}: {
  roomId: string;
  origin: string;
  invites: InviteView[];
  activeCount: number;
  invitesLoadFailed: boolean;
}) {
  const [createState, createAction, pending] = useActionState(
    createInviteAction,
    {},
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeInviteAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  const link = createState.inviteToken
    ? `${origin}/invite/${createState.inviteToken}`
    : null;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: leave the link selectable in the input above.
      setCopied(false);
    }
  }

  const atLimit = activeCount >= MAX_ACTIVE_INVITES_PER_ROOM;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Invite links</h2>
        <span className="text-xs text-muted-foreground">
          {activeCount}/{MAX_ACTIVE_INVITES_PER_ROOM} active
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Non-guessable links; only their hashes are stored. Share one to let
        members into a private room.
      </p>

      {createState.error && (
        <Notice tone="danger" className="mt-3">
          {createState.error}
        </Notice>
      )}

      {link && (
        <div className="mt-3 rounded-lg border border-border bg-muted p-3">
          <p className="text-xs font-medium text-foreground">
            New invite link — shown once:
          </p>
          <input
            type="text"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1.5 w-full rounded-md border border-input bg-card px-2 py-1.5 font-mono text-xs"
            aria-label="Invite link"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" onClick={copyLink}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {copied
                ? "Paste it somewhere safe."
                : "This link will not be shown again."}
            </span>
          </div>
        </div>
      )}

      <form action={createAction} className="mt-3 space-y-3">
        <input type="hidden" name="roomId" value={roomId} />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-36 flex-1">
            <Label htmlFor="invite-expiry">Expires</Label>
            <Select id="invite-expiry" name="expiry" defaultValue="never">
              <option value="never">Never</option>
              <option value="24h">In 24 hours</option>
              <option value="7d">In 7 days</option>
            </Select>
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={pending}
            disabled={atLimit}
          >
            Create link
          </Button>
        </div>
        {atLimit && (
          <p className="text-xs text-muted-foreground">
            Active-link limit reached — revoke one to create another.
          </p>
        )}
      </form>

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Existing links
        </h3>
        {invitesLoadFailed && (
          <Notice tone="danger" className="mt-2">
            Invites could not be loaded right now.
          </Notice>
        )}
        {!invitesLoadFailed && invites.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No invite links created yet.
          </p>
        )}
        {!invitesLoadFailed && invites.length > 0 && (
          <>
            {revokeState.error && (
              <Notice tone="danger" className="mt-2">
                {revokeState.error}
              </Notice>
            )}
            <ul className="mt-2 space-y-2">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Badge
                      tone={
                        invite.status === "revoked"
                          ? "danger"
                          : invite.status === "expired"
                            ? "warning"
                            : "success"
                      }
                    >
                      {invite.status === "revoked"
                        ? "Revoked"
                        : invite.status === "expired"
                          ? "Expired"
                          : "Active"}
                    </Badge>
                    <span className="text-muted-foreground">
                      created {invite.createdLabel}
                      {invite.expiresLabel &&
                        ` · expires ${invite.expiresLabel}`}
                    </span>
                  </span>
                  {invite.status !== "revoked" && (
                    <form action={revokeAction}>
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <input type="hidden" name="roomId" value={roomId} />
                      <button
                        type="submit"
                        disabled={revokePending}
                        className="font-medium text-danger underline-offset-4 hover:underline"
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
