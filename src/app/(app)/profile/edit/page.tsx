import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/brand";
import { ProfileForm } from "@/components/profile/profile-form";
import { getMyProfile } from "@/lib/data/profiles";

export const metadata = { title: "My profile" };

export default async function EditProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="My profile"
        description="Keep your skills and bio current so the right rooms find you."
      />
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <ProfileForm
          mode="edit"
          initial={{
            displayName: profile.display_name,
            bio: profile.bio ?? "",
            skills: profile.skills,
            experienceLevel: profile.experience_level,
          }}
          successRedirect={`/profile/${profile.id}`}
          cancelHref={`/profile/${profile.id}`}
        />
      </div>
    </div>
  );
}
