import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Server-side Supabase client bound to the request cookies.
 *
 * Returns null when credentials are missing so callers can degrade to a
 * truthful "not configured" state instead of throwing during rendering.
 *
 * Used from Server Components, Route Handlers and Server Actions. Session
 * token refresh is handled here and by `src/proxy.ts`.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore: proxy.ts refreshes the session on navigation.
        }
      },
    },
  });
}
