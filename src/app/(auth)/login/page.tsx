import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createServerSupabase();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/discover");
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <Suspense>
        <LoginForm configured={isSupabaseConfigured()} />
      </Suspense>
    </div>
  );
}
