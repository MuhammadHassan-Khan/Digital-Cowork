/**
 * Screen-share viewing policy (IMPLEMENTATION_PLAN Step 5, PRD §5).
 *
 * Pure and unit-tested: decides which screen-share tracks a viewer
 * subscribes to and renders, without touching the SDK.
 *
 * Baseline (default): exactly ONE screen share is subscribed/rendered at a
 * time and the viewer picks which one — this honors PRD §5 ("do not force
 * every viewer to render all screen feeds by default") and keeps
 * bandwidth/CPU modest on free-tier devices.
 *
 * Multi-share: experimental, gated by NEXT_PUBLIC_ENABLE_MULTI_SHARE=true.
 * Subscribes to up to MAX_MULTI_SHARES shares rendered together. It is NOT
 * considered validated until real-device tests are documented (PRD §5:
 * never claim the stretch target is validated until it is tested).
 *
 * A participant can publish at most one screen-share track in LiveKit, so
 * shares are keyed by participant identity.
 */

/** Stretch-target cap: PRD §5 allows 2–5 simultaneous publishers. */
export const MAX_MULTI_SHARES = 5;

export type ShareMode = "single" | "multi";

/** Reads the experimental gate: "true"/"1"/"yes" (case-insensitive) enables it. */
export function resolveShareMode(flag: string | undefined | null): ShareMode {
  const value = (flag ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes"
    ? "multi"
    : "single";
}

/**
 * Keeps the viewer's explicit choice while that share still exists;
 * otherwise falls back to the first active share (stable default).
 * Returns null when nothing is being shared.
 */
export function selectSharer(
  shareIds: readonly string[],
  preferredId: string | null,
): string | null {
  if (shareIds.length === 0) return null;
  if (preferredId !== null && shareIds.includes(preferredId)) {
    return preferredId;
  }
  return shareIds[0] ?? null;
}

/**
 * Which share tracks this viewer subscribes to, keyed by sharer identity:
 *  - single: only the selected share (every other share stays unsubscribed
 *    so viewers do not pay for feeds they are not watching);
 *  - multi: up to MAX_MULTI_SHARES shares, with the viewer's selection
 *    always kept inside the cap (one natural entry is dropped instead).
 */
export function planSubscriptions(input: {
  mode: ShareMode;
  shareIds: readonly string[];
  selectedId: string | null;
}): Record<string, boolean> {
  const plan: Record<string, boolean> = {};

  if (input.mode === "single") {
    for (const id of input.shareIds) plan[id] = id === input.selectedId;
    return plan;
  }

  const ids = [...input.shareIds];
  const cap = new Set(ids.slice(0, MAX_MULTI_SHARES));
  if (input.selectedId !== null && !cap.has(input.selectedId)) {
    // The cap is full: drop the last natural entry to honor the choice.
    const last = ids[MAX_MULTI_SHARES - 1];
    if (last !== undefined) cap.delete(last);
    cap.add(input.selectedId);
  }
  for (const id of ids) plan[id] = cap.has(id);
  return plan;
}

/** Ids this viewer should actually render given its subscription plan. */
export function visibleShareIds(
  shareIds: readonly string[],
  plan: Record<string, boolean>,
): string[] {
  return shareIds.filter((id) => plan[id] === true);
}
