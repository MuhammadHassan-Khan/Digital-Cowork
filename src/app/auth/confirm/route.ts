import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/route-guard";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Email-link confirmation endpoint.
 *
 * Handles both common Supabase email link shapes:
 *  - `/auth/confirm?token_hash=...&type=signup` (template uses
 *    {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...)
 *  - `/auth/confirm?code=...` (PKCE: default {{ .ConfirmationURL }} landing)
 *
 * Configure the link in Supabase Dashboard -> Authentication -> Emails, and
 * allow this URL under Authentication -> URL Configuration -> Redirect URLs.
 */

const VALID_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "recovery",
  "email_change",
  "magic_link",
];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  let confirmed = false;

  if (tokenHash && type && VALID_OTP_TYPES.includes(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    confirmed = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    confirmed = !error;
  }

  if (!confirmed) {
    return NextResponse.redirect(new URL("/login?error=confirm", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
