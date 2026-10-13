import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/ui/brand";
import { ProfileForm } from "@/components/profile/profile-form";
import { getMyProfile } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Set up your profile" };

/**
 * FLOW §1: after sign-up, a user without a profile adds display name, bio,
 * skills and experience level. RLS limits writes to their own row.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/onboarding")}`);

  const existing = await getMyProfile();
  if (existing) redirect("/discover");

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-12">
      <Link href="/" className="mb-8" aria-label="Cowork home">
        <Brand />
      </Link>

      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">
          Set up your profile
        </h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          This is what other members see in discovery. Only these fields are
          public — your email is never shown.
        </p>
        <ProfileForm mode="create" successRedirect="/discover" />
      </div>
    </div>
  );
}
