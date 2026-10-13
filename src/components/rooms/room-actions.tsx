"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import {
  closeRoomAction,
  joinRoomAction,
  leaveRoomAction,
  removeParticipantAction,
} from "@/lib/actions/rooms";

/**
 * Room interaction buttons. All authorization happens server-side in the
 * actions (plus RLS) — these components only render honest error states.
 */

export function JoinRoomButton({ roomId }: { roomId: string }) {
  const [state, action, pending] = useActionState(joinRoomAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="roomId" value={roomId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Take a seat
        </Button>
        <span className="text-xs text-muted-foreground">
          Seats are reserved server-side — first come, first served.
        </span>
      </div>
    </form>
  );
}

export function LeaveRoomButton({ roomId }: { roomId: string }) {
  const [state, action, pending] = useActionState(leaveRoomAction, {});

  return (
    <form action={action}>
      <input type="hidden" name="roomId" value={roomId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" variant="secondary" loading={pending}>
        Leave room
      </Button>
    </form>
  );
}

export function CloseRoomButton({
  roomId,
  alreadyClosed,
}: {
  roomId: string;
  alreadyClosed: boolean;
}) {
  const [state, action, pending] = useActionState(closeRoomAction, {});

  if (alreadyClosed && state.ok) {
    return (
      <Notice tone="success" title="Room closed">
        Nobody new can join. Members already seated can still leave normally.
      </Notice>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="roomId" value={roomId} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button
        type="submit"
        variant="danger"
        loading={pending}
        disabled={alreadyClosed}
        onClick={(event) => {
          const ok = window.confirm(
            "Close this room? It leaves the directory and stops accepting new members.",
          );
          if (!ok) event.preventDefault();
        }}
      >
        {alreadyClosed ? "Room closed" : "Close room"}
      </Button>
    </form>
  );
}

export function RemoveSeatButton({
  roomId,
  targetUserId,
  targetName,
}: {
  roomId: string;
  targetUserId: string;
  targetName: string;
}) {
  const [state, action, pending] = useActionState(removeParticipantAction, {});

  return (
    <form action={action}>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="targetUserId" value={targetUserId} />
      {state.error && (
        <Notice tone="danger" className="mb-2">
          {state.error}
        </Notice>
      )}
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        loading={pending}
        onClick={(event) => {
          const ok = window.confirm(
            `Remove ${targetName} from this room? Their seat frees up immediately.`,
          );
          if (!ok) event.preventDefault();
        }}
      >
        Remove
      </Button>
    </form>
  );
}
