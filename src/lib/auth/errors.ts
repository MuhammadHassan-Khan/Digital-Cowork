/**
 * Map Supabase auth errors to clear, actionable copy (PRD user story 10:
 * "useful errors"). Maps on machine-readable codes first, then falls back
 * to message sniffing, then a safe generic message.
 */

export interface AuthErrorLike {
  code?: string | null;
  message?: string | null;
}

export const AUTH_ERROR_MESSAGES = {
  invalidCredentials: "Invalid email or password.",
  emailNotConfirmed:
    "Confirm your email first — open the confirmation link we sent you.",
  alreadyRegistered:
    "An account with this email already exists. Try signing in instead.",
  weakPassword: "That password is too weak. Use at least 8 characters.",
  rateLimited: "Too many attempts. Wait a minute, then try again.",
  signupDisabled: "New signups are currently disabled right now.",
  network: "Cannot reach the authentication service. Check your connection and try again.",
  badConfirmation:
    "That confirmation link is invalid or has expired. Sign in to request a new one.",
  generic: "Something went wrong. Please try again.",
  notConfigured:
    "This app is not configured yet. Add Supabase keys to .env.local (see .env.example).",
  databaseMissing:
    "Database tables are missing. Apply supabase/migrations/*.sql in the Supabase SQL editor, then try again.",
} as const;

export function friendlyAuthError(error: AuthErrorLike | null | undefined): string {
  if (!error) return AUTH_ERROR_MESSAGES.generic;

  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();

  switch (code) {
    case "invalid_credentials":
    case "invalid_grant":
      return AUTH_ERROR_MESSAGES.invalidCredentials;
    case "email_not_confirmed":
      return AUTH_ERROR_MESSAGES.emailNotConfirmed;
    case "user_already_exists":
    case "email_exists":
    case "username_exists":
      return AUTH_ERROR_MESSAGES.alreadyRegistered;
    case "weak_password":
    case "validation_failed":
      return AUTH_ERROR_MESSAGES.weakPassword;
    case "over_email_send_rate_limit":
    case "email_rate_limit_exceeded":
    case "rate_limit_exceeded":
      return AUTH_ERROR_MESSAGES.rateLimited;
    case "signup_disabled":
      return AUTH_ERROR_MESSAGES.signupDisabled;
    case "fetch_error":
      return AUTH_ERROR_MESSAGES.network;
  }

  if (message.includes("failed to fetch") || message.includes("fetch failed")) {
    return AUTH_ERROR_MESSAGES.network;
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return AUTH_ERROR_MESSAGES.rateLimited;
  }
  if (message.includes("invalid login credentials")) {
    return AUTH_ERROR_MESSAGES.invalidCredentials;
  }
  if (message.includes("already registered") || message.includes("already been registered")) {
    return AUTH_ERROR_MESSAGES.alreadyRegistered;
  }

  return AUTH_ERROR_MESSAGES.generic;
}
