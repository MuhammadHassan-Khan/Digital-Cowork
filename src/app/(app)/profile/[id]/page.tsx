import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Notice } from "@/components/ui/notice";
import { buttonClasses } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/brand";
import { loadProfile } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/auth/session";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/validation/profile";

export const metadata = { title: "Profile" };

const DATE_FMT = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadProfile(id);

  if (result.status === "not_found") notFound();

  if (result.status === "error") {
    return (
      <Notice tone="danger" title="Profile unavailable">
        We could not load this profile right now. Please try again in a moment.
      </Notice>
    );
  }

  const profile = result.profile;
  const viewer = await getCurrentUser();
  const isOwn = viewer?.id === profile.id;

  return (
    <article className="mx-auto max-w-2xl">
      <Link
        href="/discover"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to discovery
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="flex items-start gap-4">
          <InitialsAvatar name={profile.display_name} className="size-14 text-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {profile.display_name}
              </h1>
              <Badge tone="info">
                {EXPERIENCE_LEVEL_LABELS[profile.experience_level]}
              </Badge>
              {isOwn && <Badge tone="success">You</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Member since {DATE_FMT.format(new Date(profile.created_at))}
            </p>
          </div>
          {isOwn && (
            <Link href="/profile/edit" className={buttonClasses("secondary", "sm")}>
              Edit
            </Link>
          )}
        </header>

        {profile.bio && (
          <p className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground/90">
            {profile.bio}
          </p>
        )}

        <section className="mt-6" aria-labelledby="skills-heading">
          <h2 id="skills-heading" className="text-sm font-semibold">
            Skills &amp; interests
          </h2>
          {profile.skills.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <li
                  key={skill}
                  className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground"
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No skills listed yet.
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
