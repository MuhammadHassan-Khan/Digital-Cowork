import Link from "next/link";
import { Badge } from "@/components/ui/notice";
import { InitialsAvatar } from "@/components/ui/brand";
import type { Profile } from "@/types/database";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/validation/profile";

/** Card used in discovery grids. */
export function ProfileCard({ profile }: { profile: Profile }) {
  const shownSkills = profile.skills.slice(0, 4);
  const extraSkills = profile.skills.length - shownSkills.length;

  return (
    <Link
      href={`/profile/${profile.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-center gap-3">
        <InitialsAvatar name={profile.display_name} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold group-hover:text-primary">
            {profile.display_name}
          </h3>
          <Badge tone="info" className="mt-0.5">
            {EXPERIENCE_LEVEL_LABELS[profile.experience_level]}
          </Badge>
        </div>
      </div>

      {profile.bio && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {profile.bio}
        </p>
      )}

      {shownSkills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {shownSkills.map((skill) => (
            <li
              key={skill}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {skill}
            </li>
          ))}
          {extraSkills > 0 && (
            <li className="rounded-full px-2.5 py-0.5 text-xs font-medium text-primary">
              +{extraSkills}
            </li>
          )}
        </ul>
      )}
    </Link>
  );
}
