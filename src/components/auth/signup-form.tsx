"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { ConfigNotice } from "@/components/auth/config-notice";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { AUTH_ERROR_MESSAGES, friendlyAuthError } from "@/lib/auth/errors";
import { signUpSchema } from "@/lib/validation/auth";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignupForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "pending" | "sent">(
    "idle",
  );
  const [pending, startTransition] = useTransition();

  if (!configured) return <ConfigNotice />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const form = new FormData(event.currentTarget);
    const parsed = signUpSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });

    if (!parsed.success) {
      const errors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (key in errors) continue;
        errors[key as keyof typeof errors] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (error) {
          setFormError(friendlyAuthError(error));
          return;
        }

        if (data.session) {
          // Email confirmation disabled on the project — go straight to onboarding.
          router.replace("/onboarding");
          router.refresh();
          return;
        }

        // Confirmation email required — show a clear next-step state.
        setPendingEmail(parsed.data.email);
      } catch {
        setFormError(AUTH_ERROR_MESSAGES.network);
      }
    });
  }

  function handleResend() {
    if (!pendingEmail) return;
    setResendState("pending");
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: pendingEmail,
        });
        if (error) {
          setFormError(friendlyAuthError(error));
          setResendState("idle");
          return;
        }
        setResendState("sent");
      } catch {
        setFormError(AUTH_ERROR_MESSAGES.network);
        setResendState("idle");
      }
    });
  }

  if (pendingEmail) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
        <Notice tone="success" title="Confirmation email sent">
          We sent a confirmation link to{" "}
          <span className="font-medium break-all">{pendingEmail}</span>. Open it
          to activate your account — then sign in. (Also check spam.)
        </Notice>
        {formError && <Notice tone="danger">{formError}</Notice>}
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={handleResend}
            loading={resendState === "pending"}
            disabled={resendState === "sent"}
          >
            {resendState === "sent" ? "Email sent" : "Resend confirmation email"}
          </Button>
          <Link
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Then set up a profile people can discover.
        </p>
      </div>

      {formError && <Notice tone="danger">{formError}</Notice>}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={Boolean(fieldErrors.password)}
            required
          />
          <FieldError message={fieldErrors.password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            required
          />
          <FieldError message={fieldErrors.confirmPassword} />
        </div>

        <Button type="submit" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
