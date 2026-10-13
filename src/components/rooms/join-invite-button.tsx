"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { joinViaInviteAction } from "@/lib/actions/rooms";

/**
 * Join button on the invite landing page. The raw token travels in the form
 * (server re-hashes and validates it — the client is never trusted).
 */
export function JoinInviteButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(joinViaInviteAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          Join this room
        </Button>
        <Link
          href="/rooms"
          className={buttonClasses("ghost", "md")}
        >
          Browse rooms instead
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Joining reserves your seat immediately — capacity is enforced on the
        server.
      </p>
    </form>
  );
}
