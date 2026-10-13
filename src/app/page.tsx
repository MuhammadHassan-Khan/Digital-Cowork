import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand, BrandMark } from "@/components/ui/brand";
import { buttonClasses } from "@/components/ui/button";
import { safeNextPath } from "@/lib/auth/route-guard";
import { createServerSupabase } from "@/lib/supabase/server";

const FEATURES = [
  {
    title: "Discover people",
    body: "Find members by skills, experience and bio — not by follower counts.",
  },
  {
    title: "Persistent rooms",
    body: "Public or invite-only coworking rooms for up to 10 people.",
  },
  {
    title: "Work together live",
    body: "Voice, camera, ephemeral chat and screen sharing in the same room.",
  },
];

interface HomeProps {
  searchParams: Promise<{ code?: string; next?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { code, next } = await searchParams;
  const supabase = await createServerSupabase();

  // Email-confirmation links (PKCE flow) may land here with ?code=.
  // Exchange it for a session; on failure send the user to a truthful error.
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) redirect(`/login?error=confirm`);
    redirect(safeNextPath(next));
  }

  let signedIn = false;
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Brand />
        <nav className="flex items-center gap-2 sm:gap-3">
          {signedIn ? (
            <Link href="/discover" className={buttonClasses("primary", "md")}>
              Open discovery
            </Link>
          ) : (
            <>
              <Link href="/login" className={buttonClasses("ghost", "md")}>
                Sign in
              </Link>
              <Link href="/signup" className={buttonClasses("primary", "md")}>
                Create account
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="flex flex-col items-start gap-8 py-16 sm:py-24 lg:flex-row lg:items-center lg:gap-16">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <BrandMark className="size-4" />
              Zero-budget MVP demo
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Sit down with focused people and get work done.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Cowork is a virtual coworking platform: discover members by
              skills, join a public room or an invite-only room, then work
              alongside each other with voice, video, chat and screen sharing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClasses("primary", "lg")}>
                Get started
              </Link>
              <Link href="/login" className={buttonClasses("secondary", "lg")}>
                I have an account
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-xl gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-5"
              >
                <h2 className="font-semibold">{feature.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-muted-foreground sm:px-6">
        Built as a constrained free-tier demo — see the project README for
        limits and setup.
      </footer>
    </div>
  );
}
