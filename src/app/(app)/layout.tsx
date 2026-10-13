import { requireUserWithProfile } from "@/lib/auth/session";
import { AppHeader } from "@/components/app-header";

/**
 * Protected shell: every page under (app)/ is guaranteed a signed-in user
 * with a completed profile (redirects to /login or /onboarding otherwise).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireUserWithProfile();

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        user={{
          id: profile.id,
          displayName: profile.display_name,
          experienceLevel: profile.experience_level,
        }}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
