/**
 * Small sliding-window rate limiter for the media-token endpoint
 * (PRD §7: "Add basic rate limits to invite creation and media-token
 * endpoints where the host allows it").
 *
 * In-memory and per-server-process: honest limitation of a single-instance
 * local/Hobby deployment (documented in the README). The clock is
 * injectable so tests are deterministic.
 */

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Record an attempt for `key`.
   * Returns true when the attempt is allowed, false when the user is over
   * the limit for the current window (blocked attempts are not recorded,
   * so the window slides fairly).
   */
  allow(key: string, now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    this.prune(cutoff);
    return true;
  }

  /** Drop stale keys so memory stays bounded under many users. */
  private prune(cutoff: number): void {
    if (this.hits.size <= 4_096) return;
    for (const [key, times] of this.hits) {
      const alive = times.filter((t) => t > cutoff);
      if (alive.length === 0) this.hits.delete(key);
      else this.hits.set(key, alive);
    }
  }
}

/** Per-user token requests: 20/minute (generous for reconnects, blocks abuse). */
export const TOKEN_RATE_LIMIT = { limit: 20, windowMs: 60_000 } as const;

/**
 * Per-user invite creations: 10/minute. PRD §7 asks for rate limits on
 * invite creation; the 5-active-per-room cap already bounds storage, this
 * bounds write churn and probe traffic on top of it.
 */
export const INVITE_RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

/** Shared singleton used by the token route (one per server process). */
export const tokenRequestLimiter = new SlidingWindowLimiter(
  TOKEN_RATE_LIMIT.limit,
  TOKEN_RATE_LIMIT.windowMs,
);

/** Shared singleton used by createInviteAction (one per server process). */
export const inviteRequestLimiter = new SlidingWindowLimiter(
  INVITE_RATE_LIMIT.limit,
  INVITE_RATE_LIMIT.windowMs,
);
