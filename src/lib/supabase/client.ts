import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Browser-side Supabase client (anon key + RLS).
 *
 * Throws if credentials are missing — callers must check
 * `isSupabaseConfigured()` first and render a configuration notice instead
 * of attempting auth (PRD §4 / FLOW §6 "Missing configuration" state).
 */
export function getBrowserSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
