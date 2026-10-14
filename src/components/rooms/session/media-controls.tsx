"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { LeaveRoomButton } from "@/components/rooms/room-actions";

/**
 * Microphone/camera toggles + leave control for the live session.
 *
 * Permission denial is a first-class state (PRD §10 / FLOW §6): a failed
 * publish surfaces an honest explanation and reminds the user that chat
 * still works — it rides the same data connection without media permission.
 */
export function MediaControls({ roomId }: { roomId: string }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(kind: "mic" | "camera") {
    if (busy) return;
    setMediaError(null);
    setBusy(true);
    try {
      if (kind === "mic") {
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      } else {
        await localParticipant.setCameraEnabled(!isCameraEnabled);
      }
    } catch {
      setMediaError(
        kind === "mic"
          ? "Microphone unavailable — the browser may have blocked permission. Check the site's mic permission and try again; text chat still works without it."
          : "Camera unavailable — the browser may have blocked permission. Check the site's camera permission and try again; text chat still works without it.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isMicrophoneEnabled ? "secondary" : "ghost"}
          size="sm"
          disabled={busy}
          aria-pressed={isMicrophoneEnabled}
          onClick={() => void toggle("mic")}
        >
          {isMicrophoneEnabled ? "Mic on" : "Mic muted"}
        </Button>
        <Button
          type="button"
          variant={isCameraEnabled ? "secondary" : "ghost"}
          size="sm"
          disabled={busy}
          aria-pressed={isCameraEnabled}
          onClick={() => void toggle("camera")}
        >
          {isCameraEnabled ? "Camera on" : "Camera off"}
        </Button>
        <span className="ml-auto">
          <LeaveRoomButton roomId={roomId} />
        </span>
      </div>
      {mediaError && <Notice tone="warning">{mediaError}</Notice>}
    </div>
  );
}
