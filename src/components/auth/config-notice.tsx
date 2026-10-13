import { Notice } from "@/components/ui/notice";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/errors";

/**
 * Truthful state for a missing/broken configuration (PRD §4: missing
 * configuration must produce a clear state, never fake success).
 */
export function ConfigNotice() {
  return (
    <Notice tone="warning" title="Supabase is not configured">
      <p>
        Authentication is disabled until credentials are provided. Copy{" "}
        <code className="font-mono">.env.example</code> to{" "}
        <code className="font-mono">.env.local</code> and fill in your
        Supabase project URL and anon key, then restart the dev server.
      </p>
    </Notice>
  );
}

const PAGE_MESSAGES: Record<string, string> = {
  confirm: AUTH_ERROR_MESSAGES.badConfirmation,
};

/** Friendly message for `?error=` codes used by auth redirects. */
export function AuthErrorNotice({ code }: { code?: string | null }) {
  if (!code) return null;
  const message = PAGE_MESSAGES[code];
  if (!message) return null;
  return (
    <Notice tone="danger" title="Sign-in problem">
      {message}
    </Notice>
  );
}
