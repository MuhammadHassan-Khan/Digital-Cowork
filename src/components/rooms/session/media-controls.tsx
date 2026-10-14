"use client";

import { useEffect, useState } from "react";
import { ParticipantEvent, Track } from "livekit-client";
import { useLocalParticipant } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { LeaveRoomButton } from "@/components/rooms/room-actions";

/**
 * Microphone/camera/screen-share toggles + leave control for the live
 * session.
 *
 * Permission denial is a first-class state (PRD §10 / FLOW §6): a failed
 * publish surfaces an honest explanation and reminds the user that chat
 * still works — it rides the same data connection without media permission.
 *
 * Screen share (Step 5): capture starts only on explicit click; dismissing
 * the browser's picker or being denied shows a truthful "nothing was
 * shared" notice. Stopping — via our button OR the browser's own "Stop
 * sharing" control — is acknowledged by listening for the local track
 * unpublish event, so the UI never claims a share is live after it ended.
 */
export function MediaControls({ roomId }: { roomId: string }) {
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Acknowledge share stops from any source (our button, the browser's
  // native stop control, or a reconnect that dropped the track).
  useEffect(() => {
    const onUnpublished = (publication: { source?: string }) => {
      if (publication.source === Track.Source.ScreenShare) {
        setShareNotice(
          "Screen sharing stopped — you ended it, or the browser's own stop control did.",
        );
      }
    };
    localParticipant.on(ParticipantEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      localParticipant.off(
        ParticipantEvent.LocalTrackUnpublished,
        onUnpublished,
      );
    };
  }, [localParticipant]);

  async function toggle(kind: "mic" | "camera") {
    if (busy) return;
    setMediaError(null);
    setShareNotice(null);
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

  async function toggleShare() {
    if (busy) return;
    setMediaError(null);
    setShareNotice(null);
    setBusy(true);
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, {
        audio: false, // never capture system audio (privacy-minimal default)
        contentHint: "detail", // text/code-heavy coworking content
        // Resolution intentionally unset: LiveKit's default caps capture at
        // 1080p — PRD §5 asks for reasonable defaults, not forced maximums.
      });
    } catch {
      setMediaError(
        "Screen share permission was denied or the picker was closed — nothing was shared. Voice, camera and text chat keep working.",
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
        <Button
          type="button"
          variant={isScreenShareEnabled ? "secondary" : "ghost"}
          size="sm"
          disabled={busy}
          aria-pressed={isScreenShareEnabled}
          onClick={() => void toggleShare()}
        >
          {isScreenShareEnabled ? "Stop sharing" : "Share screen"}
        </Button>
        <span className="ml-auto">
          <LeaveRoomButton roomId={roomId} />
        </span>
      </div>
      {mediaError && <Notice tone="warning">{mediaError}</Notice>}
      {shareNotice && <Notice tone="info">{shareNotice}</Notice>}
    </div>
  );
}
