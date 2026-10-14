"use client";

import { useEffect, useMemo, useState } from "react";
import { Track } from "livekit-client";
import {
  useLocalParticipant,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/notice";
import { env } from "@/lib/env";
import {
  MAX_MULTI_SHARES,
  planSubscriptions,
  resolveShareMode,
  selectSharer,
  visibleShareIds,
} from "@/lib/livekit/screen-share";

type ShareTrackRef = NonNullable<Parameters<typeof VideoTrack>[0]["trackRef"]>;

/**
 * Screen-share stage (Step 5 / PRD §5).
 *
 * Baseline (default): one screen share rendered at a time; with several
 * active shares the viewer picks which one to watch, and only that track
 * stays subscribed — other feeds are unsubscribed so viewers never pay
 * bandwidth for screens they are not watching.
 *
 * Experimental multi-share (NEXT_PUBLIC_ENABLE_MULTI_SHARE=true): renders
 * up to MAX_MULTI_SHARES shares together, clearly labeled experimental.
 *
 * Sharer identity is always visible (PRD §4 acceptance: "make it clear
 * which user is sharing"). Renders nothing when no share is active.
 */
export function ShareStage() {
  const mode = resolveShareMode(env.enableMultiShare);
  const shareRefs = useTracks([Track.Source.ScreenShare]);
  const { localParticipant } = useLocalParticipant();
  const [explicitChoice, setExplicitChoice] = useState<string | null>(null);

  const shareIds = useMemo(
    () => shareRefs.map((ref) => ref.participant.identity),
    [shareRefs],
  );
  // Explicit viewer choice persists while that share exists; otherwise the
  // default follows the first active share in participant order (stable —
  // the track list only changes when someone starts/stops sharing).
  const selectedId = selectSharer(shareIds, explicitChoice);
  const plan = useMemo(
    () => planSubscriptions({ mode, shareIds, selectedId }),
    [mode, shareIds, selectedId],
  );

  // Apply the subscription plan (PRD §5 viewer choice + bandwidth saving).
  // Local publications are skipped — subscription is remote-only; duck-typed
  // instead of `instanceof` so it works across SDK module copies.
  useEffect(() => {
    for (const ref of shareRefs) {
      const publication = ref.publication as
        | {
            setSubscribed?: (subscribed: boolean) => void;
            isSubscribed?: boolean;
          }
        | undefined;
      if (typeof publication?.setSubscribed !== "function") continue;
      const want = plan[ref.participant.identity] ?? false;
      if (publication.isSubscribed !== want) publication.setSubscribed(want);
    }
  }, [shareRefs, plan]);

  if (shareRefs.length === 0) return null;

  const localId = localParticipant.identity;
  const labelFor = (ref: ShareTrackRef) => {
    const identity = ref.participant.identity;
    if (identity === localId) return "You are sharing your screen";
    return `${ref.participant.name || identity} is sharing their screen`;
  };
  const shortLabelFor = (ref: ShareTrackRef) => {
    const identity = ref.participant.identity;
    if (identity === localId) return "Your screen";
    return ref.participant.name || identity;
  };

  const visibleIds = new Set(visibleShareIds(shareIds, plan));
  const visibleRefs = shareRefs.filter((ref) =>
    visibleIds.has(ref.participant.identity),
  );
  const selectedRef =
    shareRefs.find((ref) => ref.participant.identity === selectedId) ??
    shareRefs[0];
  const showPicker =
    (mode === "single" && shareRefs.length > 1) ||
    (mode === "multi" && shareRefs.length > MAX_MULTI_SHARES);

  return (
    <section aria-label="Screen sharing" className="space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Screen share</h3>
        {mode === "multi" && shareRefs.length > 1 && (
          <Badge tone="warning">Experimental multi-share</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {showPicker
            ? `${shareRefs.length} screens are being shared — choose which to view:`
            : shareRefs.length === 1
              ? "1 screen shared"
              : `${shareRefs.length} screens shared`}
        </span>
      </header>

      {showPicker && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Choose a screen share to view"
        >
          {shareRefs.map((ref) => {
            const identity = ref.participant.identity;
            return (
              <Button
                key={identity}
                type="button"
                size="sm"
                variant={identity === selectedId ? "secondary" : "ghost"}
                aria-pressed={identity === selectedId}
                onClick={() => setExplicitChoice(identity)}
              >
                {shortLabelFor(ref)}
              </Button>
            );
          })}
        </div>
      )}

      {mode === "single" ? (
        selectedRef && (
          <ShareTile trackRef={selectedRef} caption={labelFor(selectedRef)} />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleRefs.map((ref) => (
            <ShareTile
              key={ref.participant.identity}
              trackRef={ref}
              caption={labelFor(ref)}
            />
          ))}
        </div>
      )}

      {mode === "multi" && shareRefs.length > MAX_MULTI_SHARES && (
        <p className="text-xs text-muted-foreground">
          Showing {MAX_MULTI_SHARES} of {shareRefs.length} shares
          (experimental cap) — pick one above to swap it in.
        </p>
      )}
    </section>
  );
}

function ShareTile({
  trackRef,
  caption,
}: {
  trackRef: ShareTrackRef;
  caption: string;
}) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-black">
      <div className="aspect-video w-full">
        <VideoTrack
          trackRef={trackRef}
          className="h-full w-full object-contain"
        />
      </div>
      <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
}
