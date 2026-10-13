import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SignupPage() {
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
        <SignupForm configured={isSupabaseConfigured()} />
      </Suspense>
    </div>
  );
}
