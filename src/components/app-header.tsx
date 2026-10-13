"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Brand, InitialsAvatar } from "@/components/ui/brand";
import { buttonClasses } from "@/components/ui/button";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { ExperienceLevel } from "@/lib/validation/profile";

const NAV_ITEMS = [
  { href: "/discover", label: "Discover" },
  // "/rooms" joins the nav when the rooms module ships (Stage 2 / Step 3).
  { href: "/profile/edit", label: "My profile" },
] as const;

interface HeaderUser {
  id: string;
  displayName: string;
  experienceLevel: ExperienceLevel;
}

export function AppHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/discover" aria-label="Cowork discovery">
            <Brand markClassName="size-6" className="text-base" />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/profile/${user.id}`}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-muted"
          >
            <InitialsAvatar name={user.displayName} className="size-7 text-xs" />
            <span className="hidden max-w-32 truncate font-medium sm:inline">
              {user.displayName}
            </span>
          </Link>
          <SignOutButton />
        </div>
      </div>

      {/* Compact nav for small screens */}
      <nav
        aria-label="Main (compact)"
        className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ${
                active ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function signOut() {
    setError(null);
    startTransition(async () => {
      try {
        const supabase = getBrowserSupabase();
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          setError(AUTH_ERROR_MESSAGES.network);
          return;
        }
        router.replace("/login");
        router.refresh();
      } catch {
        setError(AUTH_ERROR_MESSAGES.network);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="hidden text-xs text-danger md:inline">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className={buttonClasses("secondary", "sm")}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
