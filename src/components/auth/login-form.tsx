"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { AuthErrorNotice, ConfigNotice } from "@/components/auth/config-notice";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { AUTH_ERROR_MESSAGES, friendlyAuthError } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/route-guard";
import { signInSchema } from "@/lib/validation/auth";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const redirectError = searchParams.get("error");

  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "pending" | "sent">(
    "idle",
  );
  const [pending, startTransition] = useTransition();

  if (!configured) return <ConfigNotice />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNeedsConfirmation(false);

    const form = new FormData(event.currentTarget);
    const parsed = signInSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") errors.email = issue.message;
        if (issue.path[0] === "password") errors.password = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (error) {
          setFormError(friendlyAuthError(error));
          if (error.code === "email_not_confirmed") setNeedsConfirmation(true);
          return;
        }

        router.replace(nextPath);
        router.refresh();
      } catch {
        setFormError(AUTH_ERROR_MESSAGES.network);
      }
    });
  }

  function handleResend() {
    const emailInput = document.getElementById("login-form")?.querySelector<HTMLInputElement>("input[name=email]");
    const email = emailInput?.value ?? "";
    if (!email) {
      setFormError("Enter your email address first, then request a new link.");
      return;
    }
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error } = await supabase.auth.resend({ type: "signup", email });
        if (error) {
          setFormError(friendlyAuthError(error));
          return;
        }
        setResendState("sent");
      } catch {
        setFormError(AUTH_ERROR_MESSAGES.network);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to find your room and teammates.
        </p>
      </div>

      <AuthErrorNotice code={redirectError} />
      {formError && <Notice tone="danger">{formError}</Notice>}
      {resendState === "sent" && (
        <Notice tone="success">
          Confirmation email sent. Open the link, then sign in.
        </Notice>
      )}

      <form id="login-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            required
          />
          <FieldError message={fieldErrors.email} />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(fieldErrors.password)}
            required
          />
          <FieldError message={fieldErrors.password} />
        </div>

        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>

      {needsConfirmation && (
        <div className="text-center text-sm text-muted-foreground">
          <p>Still need to confirm your email?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={pending}
            className="mt-1 font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
          >
            Resend confirmation email
          </button>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
