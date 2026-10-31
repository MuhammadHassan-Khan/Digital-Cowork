import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { Reveal } from "@/components/landing/reveal";
import { Brand, BrandMark } from "@/components/ui/brand";
import { buttonClasses } from "@/components/ui/button";
import { safeNextPath } from "@/lib/auth/route-guard";
import { createServerSupabase } from "@/lib/supabase/server";

/* --------------------------------------------------------------------------
   Content. Icons are hand-rolled stroke SVGs — no icon dependency, and they
   inherit currentColor so they follow the light/dark tokens automatically.
-------------------------------------------------------------------------- */

const ICON_CLASSES = {
  className: "size-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const FEATURES: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Discover people",
    body: "Find members by skills, experience and bio — not by follower counts.",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON_CLASSES}>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
        <circle cx="9" cy="7.5" r="3.5" />
        <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
        <path d="M16.5 4.13a4 4 0 0 1 0 6.74" />
      </svg>
    ),
  },
  {
    title: "Persistent rooms",
    body: "Public or invite-only coworking rooms for up to 10 people.",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON_CLASSES}>
        <path d="M3 21h18" />
        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        <path d="M14.5 12h.01" />
      </svg>
    ),
  },
  {
    title: "Work together live",
    body: "Voice, camera, ephemeral chat and screen sharing in the same room.",
    icon: (
      <svg viewBox="0 0 24 24" {...ICON_CLASSES}>
        <rect x="2" y="6" width="13" height="12" rx="2" />
        <path d="m22 8-7 4 7 4V8Z" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create a profile",
    body: "List the skills you bring and the kind of focus you want from a session.",
  },
  {
    number: "02",
    title: "Join or open a room",
    body: "Hop into a public room, open an invite-only one, or start your own.",
  },
  {
    number: "03",
    title: "Work side by side",
    body: "Turn on voice and camera, share your screen, and get things done together.",
  },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </p>
  );
}

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
      {/* Reveal blocks must stay readable when JavaScript is unavailable. */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
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
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ------------------------------ Hero ------------------------------ */}
        <section className="relative overflow-hidden">
          <div className="hero-grid" aria-hidden="true" />
          <div
            className="glow -left-[8%] -top-[30%] size-[min(45vw,34rem)]"
            aria-hidden="true"
          />
          <div
            className="glow -right-[10%] top-[35%] size-[min(38vw,28rem)]"
            style={{ animationDuration: "26s", animationDelay: "-9s" }}
            aria-hidden="true"
          />

          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-28 pt-16 text-center sm:px-6 sm:pt-24">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <BrandMark className="size-4" />
                Zero-budget MVP demo
              </p>
            </Reveal>

            <Reveal delay={90} className="mt-6 w-full">
              <h1 className="text-display-lg mx-auto max-w-4xl">
                Sit down with{" "}
                <span className="bg-linear-to-r from-primary to-ring bg-clip-text text-transparent">
                  focused people
                </span>{" "}
                and get work done.
              </h1>
            </Reveal>

            <Reveal delay={180} className="mt-6 w-full">
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Cowork is a virtual coworking platform: discover members by
                skills, join a public or invite-only room, then work alongside
                each other with voice, video, chat and screen sharing.
              </p>
            </Reveal>

            <Reveal delay={270} className="mt-9 w-full">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {signedIn ? (
                  <Link
                    href="/discover"
                    className={buttonClasses("primary", "lg", "landing-cta")}
                  >
                    Open discovery
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className={buttonClasses("primary", "lg", "landing-cta")}
                    >
                      Get started
                    </Link>
                    <Link
                      href="/login"
                      className={buttonClasses("secondary", "lg", "landing-cta")}
                    >
                      I have an account
                    </Link>
                  </>
                )}
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Public and invite-only rooms for up to 10 people.
              </p>
            </Reveal>
          </div>

          <a href="#features" className="scroll-cue">
            Scroll
            <span className="scroll-cue__rail" aria-hidden="true" />
          </a>
        </section>

        {/* ---------------------------- Features ---------------------------- */}
        <section
          id="features"
          className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28"
        >
          <Reveal className="max-w-2xl">
            <Eyebrow>Why Cowork</Eyebrow>
            <h2 className="text-display-md mt-4">
              Everything a focused session needs.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              No feed to scroll, no follower counts — just people, rooms and
              the tools to work together.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <Reveal
                key={feature.title}
                delay={index * 100}
                className="h-full"
              >
                <div className="feature-card">
                  <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {feature.icon}
                  </span>
                  <h3 className="mt-4 text-base font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* -------------------------- How it works -------------------------- */}
        <section
          id="how-it-works"
          className="border-y border-border bg-muted/40"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <Reveal className="max-w-2xl">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="text-display-md mt-4">
                From sign-up to a shared desk in minutes.
              </h2>
            </Reveal>

            <ol className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
              {STEPS.map((step, index) => (
                <li key={step.number}>
                  <Reveal delay={index * 100}>
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground">
                      {step.number}
                    </span>
                    <h3 className="mt-4 text-base font-semibold">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ----------------------------- CTA ------------------------------- */}
        <section
          id="get-started"
          className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24"
        >
          <Reveal>
            <div className="glass-panel px-6 py-14 text-center sm:px-12 sm:py-16">
              <div
                className="glow -left-[6%] -top-[70%] size-[min(40vw,24rem)]"
                aria-hidden="true"
              />
              <div
                className="glow -bottom-[80%] -right-[8%] size-[min(36vw,22rem)]"
                style={{ animationDuration: "24s", animationDelay: "-12s" }}
                aria-hidden="true"
              />

              <div className="relative">
                <h2 className="text-display-md mx-auto max-w-2xl">
                  Ready to sit down with someone focused?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Create an account, open a room, and invite the people you
                  want to work with.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  {signedIn ? (
                    <Link
                      href="/discover"
                      className={buttonClasses("primary", "lg", "landing-cta")}
                    >
                      Open discovery
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/signup"
                        className={buttonClasses(
                          "primary",
                          "lg",
                          "landing-cta",
                        )}
                      >
                        Create account
                      </Link>
                      <Link
                        href="/login"
                        className={buttonClasses(
                          "ghost",
                          "lg",
                          "landing-cta",
                        )}
                      >
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border">
        <p className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-muted-foreground sm:px-6">
          Built as a constrained free-tier demo — see the project README for
          limits and setup.
        </p>
      </footer>
    </div>
  );
}
