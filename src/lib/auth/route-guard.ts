/**
 * Pure route-access logic shared by `src/proxy.ts` and its unit tests.
 * Keeping this framework-light makes the authorization matrix testable
 * without booting Next.js (ARCHITECTURE §8: unit tests for role checks).
 */

export type RouteKind = "auth" | "protected" | "public";

/** Routes only for signed-out users (signed-in users bounce to discovery). */
const AUTH_PAGES = ["/login", "/signup"] as const;

/** Routes that require an authenticated session. Extend as rooms land. */
const PROTECTED_PREFIXES = [
  "/discover",
  "/profile",
  "/onboarding",
  "/rooms",
  "/settings",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function classifyPath(pathname: string): RouteKind {
  if (AUTH_PAGES.some((page) => matchesPrefix(pathname, page))) return "auth";
  if (PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p)))
    return "protected";
  return "public";
}

/**
 * Sanitize a post-login redirect target so it can never leave this site
 * (open-redirect protection). Accepts only sane same-origin paths.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/discover";
  if (raw.length > 512) return "/discover";
  // Must be an absolute site path: "/...", not "//host" or "/\host".
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/discover";
  }
  // No embedded scheme smuggling.
  if (/^\/[^/]*:/.test(raw)) return "/discover";
  return raw;
}

export interface GuardInput {
  pathname: string;
  /** Supabase credentials present and well-formed. */
  configured: boolean;
  /** Valid session confirmed server-side via supabase.auth.getUser(). */
  isAuthed: boolean;
}

export type GuardDecision =
  | { kind: "allow" }
  | { kind: "redirect"; location: string };

/**
 * Decide what the proxy should do for a request.
 *
 * - Not configured: keep users off protected areas; auth pages render the
 *   configuration notice (truthful state, never fake success).
 * - Protected + signed out: bounce to login carrying `next` for redirect-back.
 * - Auth page + signed in: bounce to discovery.
 */
export function resolveRouteGuard(input: GuardInput): GuardDecision {
  const kind = classifyPath(input.pathname);

  if (!input.configured) {
    if (kind === "protected") return { kind: "redirect", location: "/login" };
    return { kind: "allow" };
  }

  if (kind === "protected" && !input.isAuthed) {
    return {
      kind: "redirect",
      location: `/login?next=${encodeURIComponent(input.pathname)}`,
    };
  }

  if (kind === "auth" && input.isAuthed) {
    return { kind: "redirect", location: "/discover" };
  }

  return { kind: "allow" };
}
