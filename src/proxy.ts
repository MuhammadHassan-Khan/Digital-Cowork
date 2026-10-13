import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteGuard } from "@/lib/auth/route-guard";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Next.js 16 `proxy` (formerly middleware) — runs before route rendering.
 *
 * Responsibilities:
 *  1. Refresh/rotate the Supabase session cookies on every navigation.
 *  2. Enforce coarse route access (protected/auth pages) after verifying the
 *     session server-side with `getUser()` — never with a client claim.
 *
 * NOT handled here (by design):
 *  - Fine-grained authorization (host actions, room capacity, invite checks)
 *    must live inside each Server Action / Route Handler, because proxy can
 *    be bypassed for some server-function paths (Next docs: verify auth
 *    inside each handler, do not rely on proxy alone).
 *  - `/api/*` is excluded from the matcher; those handlers self-authorize.
 */
export async function proxy(request: NextRequest) {
  const configured = isSupabaseConfigured();
  let isAuthed = false;
  let response = NextResponse.next({ request });

  if (configured) {
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // getUser() validates the JWT against the Auth server (not just decode).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthed = Boolean(user);
  }

  const decision = resolveRouteGuard({
    pathname: request.nextUrl.pathname,
    configured,
    isAuthed,
  });

  if (decision.kind === "redirect") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }

  return response;
}

export const config = {
  // Exclude static assets and API routes (API handlers self-authorize).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
