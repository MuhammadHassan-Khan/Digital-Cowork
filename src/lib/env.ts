/**
 * Public (browser-safe) environment access.
 *
 * Only NEXT_PUBLIC_* values belong here — Next.js inlines them into both
 * server and client bundles at build time. Server-only secrets
 * (SUPABASE_SERVICE_ROLE_KEY, LIVEKIT_API_SECRET, ...) must be read directly
 * via process.env inside server-only modules, never imported from here.
 */

const HTTP_URL = /^https?:\/\/\S+$/;
const WS_URL = /^wss?:\/\/\S+$/;

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  /** Public WebSocket URL of the LiveKit deployment (browser connects here). */
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "",
  /**
   * Experimental screen-share gate (Stage 4). Empty/false keeps the
   * reliable single-share baseline; "true" enables the multi-share stretch
   * target (see src/lib/livekit/screen-share.ts).
   */
  enableMultiShare: process.env.NEXT_PUBLIC_ENABLE_MULTI_SHARE ?? "",
};

/**
 * True when Supabase credentials are present and well-formed.
 *
 * When this is false the app must show a truthful "not configured" state
 * (PRD §4: missing configuration must produce a clear state, not fake success)
 * instead of pretending auth or media works.
 */
export function isSupabaseConfigured(): boolean {
  return HTTP_URL.test(env.supabaseUrl) && env.supabaseAnonKey.length > 0;
}

/**
 * True when the PUBLIC LiveKit URL is present and well-formed.
 *
 * The full LiveKit configuration (including the server-only API key/secret)
 * is verified by `isLivekitConfigured()` in `src/lib/livekit/server.ts` —
 * this helper only tells the browser half of the story.
 */
export function isLivekitUrlConfigured(): boolean {
  return WS_URL.test(env.livekitUrl);
}
