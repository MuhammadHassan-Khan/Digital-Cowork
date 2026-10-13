import { DiscoverFilters } from "@/components/discovery/discover-filters";
import { ProfileCard } from "@/components/discovery/profile-card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/brand";
import { searchProfiles } from "@/lib/data/profiles";
import { getCurrentUser } from "@/lib/auth/session";
import {
  experienceLevelSchema,
  type ExperienceLevel,
} from "@/lib/validation/profile";

export const metadata = { title: "Discover" };

interface DiscoverPageProps {
  searchParams: Promise<{ q?: string; level?: string }>;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 60);

  // Only trust a level value that matches the allowed enum; ignore garbage.
  const levelParse = experienceLevelSchema.safeParse(params.level ?? "");
  const level: ExperienceLevel | null = levelParse.success
    ? levelParse.data
    : null;

  const viewer = await getCurrentUser();
  const { profiles, failed } = await searchProfiles({
    q,
    level,
    excludeId: viewer?.id ?? null,
  });

  const hasFilters = q !== "" || level !== null;

  return (
    <div>
      <PageHeader
        title="Discover members"
        description="Find people by skill, bio or experience — then open a profile."
      />

      <DiscoverFilters q={q} level={level ?? ""} />

      <div className="mt-6">
        {failed && (
          <Notice tone="danger" title="Search unavailable">
            Member search could not be completed right now. The database may be
            unreachable or migrations may not be applied yet — try again in a
            moment.
          </Notice>
        )}

        {!failed && profiles.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-medium">
              {hasFilters ? "No members match your filters" : "No members yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Try a broader search term or clear the filters."
                : "Once people sign up and finish their profiles, they will appear here."}
            </p>
            {hasFilters && (
              <a
                href="/discover"
                className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Clear filters
              </a>
            )}
          </div>
        )}

        {!failed && profiles.length > 0 && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {profiles.length} member{profiles.length === 1 ? "" : "s"}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <li key={profile.id}>
                  <ProfileCard profile={profile} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
