"use client";

import "@livekit/components-styles";

import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackLoop,
  useConnectionState,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { MediaDeviceFailure, Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/notice";
import { ChatPanel } from "./chat-panel";
import { MediaControls } from "./media-controls";
import { ShareStage } from "./share-stage";

/**
 * Live media session for a seated member (Step 4).
 *
 * Flow: request a short-lived token from the server (which re-checks
 * session + seat + room state), connect to LiveKit, then render real
 * participants, controls and ephemeral chat. Every failure path — missing
 * configuration, refused token, unreachable server, permission denial —
 * renders a truthful state; nothing here ever fakes a connected session
 * (PRD §4, FLOW §6).
 */

type TokenState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; token: string };

interface RoomSessionProps {
  roomId: string;
  /** NEXT_PUBLIC_LIVEKIT_URL (validated server-side before rendering). */
  serverUrl: string;
}

export function RoomSession(props: RoomSessionProps) {
  const [attempt, setAttempt] = useState(0);
  // Remounting on retry gives a fresh loading state without any
  // setState-inside-effect gymnastics.
  return (
    <TokenGate
      key={attempt}
      {...props}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function TokenGate({
  roomId,
  serverUrl,
  onRetry,
}: RoomSessionProps & { onRetry: () => void }) {
  const [tokenState, setTokenState] = useState<TokenState>({
    phase: "loading",
  });
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [deviceFailure, setDeviceFailure] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function requestToken() {
      try {
        const response = await fetch(`/api/rooms/${roomId}/token`, {
          method: "POST",
        });
        const body: unknown = await response.json().catch(() => null);
        if (cancelled) return;

        const token =
          response.ok &&
          typeof body === "object" &&
          body !== null &&
          typeof (body as { token?: unknown }).token === "string"
            ? ((body as { token: string }).token)
            : null;

        if (token) {
          setTokenState({ phase: "ready", token });
          return;
        }

        const message =
          typeof body === "object" &&
          body !== null &&
          typeof (body as { error?: unknown }).error === "string"
            ? ((body as { error: string }).error)
            : `The media service rejected the join request (HTTP ${response.status}).`;
        setTokenState({ phase: "error", message });
      } catch {
        if (cancelled) return;
        setTokenState({
          phase: "error",
          message:
            "Network error while requesting room access — check your connection, then retry. Your seat stays reserved.",
        });
      }
    }

    void requestToken();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (tokenState.phase === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        Requesting secure room access…
      </div>
    );
  }

  if (tokenState.phase === "error") {
    return (
      <div className="space-y-3">
        <Notice tone="danger" title="Could not start the live session">
          {tokenState.message}
        </Notice>
        <Button type="button" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={tokenState.token}
      // Join WITHOUT media: permissions are requested only on explicit
      // toggles, so chat works even when mic/camera stay denied (PRD §4).
      audio={false}
      video={false}
      options={{
        // PRD §5: adaptive viewer-side quality + dynacast (stop sending
        // layers nobody subscribes to — matters once shares multiply).
        adaptiveStream: true,
        dynacast: true,
      }}
      onError={(error) => {
        const status = (error as Error & { status?: number }).status;
        if (error.name === "ConnectionError" && status === 429) {
          // FLOW §6: quota exhaustion → truthful "temporarily unavailable",
          // never an automatic retry loop (retries are manual via Rejoin).
          setSessionError(
            "The media service is temporarily unavailable — free-tier quota or a rate limit was reached. Try again in a few minutes; the app will not retry on its own.",
          );
          return;
        }
        if (
          error.name === "ConnectionError" ||
          error.name === "SignallingConnectionError"
        ) {
          setSessionError(
            "Could not reach the media server — check your connection, or the session token may have expired. Press Rejoin to fetch a fresh token.",
          );
          return;
        }
        setSessionError(`Live session error: ${error.message}`);
      }}
      onMediaDeviceFailure={(failure, kind) =>
        setDeviceFailure(deviceFailureMessage(failure, kind))
      }
    >
      <SessionInner
        roomId={roomId}
        sessionError={sessionError}
        deviceFailure={deviceFailure}
        onRejoin={onRetry}
      />
    </LiveKitRoom>
  );
}

function SessionInner({
  roomId,
  sessionError,
  deviceFailure,
  onRejoin,
}: {
  roomId: string;
  sessionError: string | null;
  deviceFailure: string | null;
  /** Remounts TokenGate → requests a NEW token (expired-token recovery). */
  onRejoin: () => void;
}) {
  const room = useRoomContext();
  const connection = useConnectionState(room);
  // One tile per participant: camera track when published, a truthful
  // placeholder (avatar, muted indicators) otherwise. TrackLoop supplies the
  // TrackRefContext that ParticipantTile requires (ParticipantLoop only
  // provides ParticipantContext — using it here crashed with
  // "No TrackRef" on the first live run).
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  const status = CONNECTION_STATUS[connection] ?? CONNECTION_STATUS.disconnected;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Live session</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="text-xs text-muted-foreground">
            {cameraTracks.length} in room
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Mic and camera start off — switch them on below when you&apos;re
          ready.
        </p>
      </div>

      {sessionError && <Notice tone="danger">{sessionError}</Notice>}
      {deviceFailure && <Notice tone="warning">{deviceFailure}</Notice>}

      {connection === "disconnected" && (
        <Notice tone="danger" title="Disconnected from the media server">
          <p>
            The live connection ended (network interruption or the session
            expired). Rejoining issues a fresh token; if you were removed or
            the room closed, the page will show that state instead.
          </p>
          <div className="mt-2">
            <Button type="button" size="sm" onClick={onRejoin}>
              Rejoin
            </Button>
          </div>
        </Notice>
      )}

      {/* Screen-share stage (renders only while a share is active). */}
      <ShareStage />

      <div className="grid gap-3 sm:grid-cols-2">
        <TrackLoop tracks={cameraTracks}>
          {/* The tile has no intrinsic height (placeholder is absolutely
              positioned), so the wrapper provides the 16:9 box — same
              pattern as ShareStage. */}
          <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
            <ParticipantTile className="h-full" />
          </div>
        </TrackLoop>
      </div>

      <MediaControls roomId={roomId} />
      <ChatPanel />

      {/* Plays remote audio for the whole room (autoplay-safe start). */}
      <RoomAudioRenderer />
    </div>
  );
}

const CONNECTION_STATUS = {
  connecting: { tone: "warning" as const, label: "Connecting…" },
  connected: { tone: "success" as const, label: "Connected" },
  reconnecting: { tone: "warning" as const, label: "Reconnecting…" },
  signalReconnecting: { tone: "warning" as const, label: "Reconnecting…" },
  disconnected: { tone: "danger" as const, label: "Disconnected" },
};

function deviceFailureMessage(
  failure: MediaDeviceFailure | undefined,
  kind?: MediaDeviceKind,
): string {
  const device =
    kind === "audioinput"
      ? "Microphone"
      : kind === "videoinput"
        ? "Camera"
        : "Media device";
  switch (failure) {
    case MediaDeviceFailure.PermissionDenied:
      return `${device} permission was denied — allow it in your browser's site settings to use it. Text chat still works without it.`;
    case MediaDeviceFailure.NotFound:
      return `${device} not found — check that it is connected. Text chat still works without it.`;
    case MediaDeviceFailure.DeviceInUse:
      return `${device} is in use by another application. Text chat still works without it.`;
    default:
      return `${device} could not be started. Text chat still works without it.`;
  }
}
