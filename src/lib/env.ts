/**
 * Public (browser-safe) environment access.
 *
 * Only NEXT_PUBLIC_* values belong here — Next.js inlines them into both
 * server and client bundles at build time. Server-only secrets
 * (SUPABASE_SERVICE_ROLE_KEY, LIVEKIT_API_SECRET, ...) must be read directly
 * via process.env inside server-only modules, never imported from here.
 */

const HTTP_URL = /^https?:\/\/\S+$/;

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
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
