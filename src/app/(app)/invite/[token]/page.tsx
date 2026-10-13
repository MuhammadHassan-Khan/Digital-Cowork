import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/brand";
import { Badge, Notice } from "@/components/ui/notice";
import { JoinInviteButton } from "@/components/rooms/join-invite-button";
import { requireUserWithProfile } from "@/lib/auth/session";
import { getMySeat, resolveInvite } from "@/lib/data/rooms";
import { inviteReasonMessage } from "@/lib/rooms/join-status";
import { isValidInviteTokenShape } from "@/lib/rooms/room-tokens";

export const metadata = { title: "Room invite" };

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * Invite landing page. The raw link token is validated server-side through
 * the `get_room_invite` RPC (hosts-only table behind RLS); invalid, revoked,
 * expired and closed states each get an honest, distinct message.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const { user } = await requireUserWithProfile();

  const invite = isValidInviteTokenShape(token)
    ? await resolveInvite(token)
    : null;

  if (!invite || !invite.valid) {
    const message = invite
      ? inviteReasonMessage(invite.reason)
      : "This invite link is not valid. It may be mistyped, or it came from an old message.";
    const title = invite ? "Invite unavailable" : "Invite link not valid";

    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <Notice tone="warning" className="mt-4">
            {message}
          </Notice>
          <Link
            href="/rooms"
            className={`mt-5 inline-block ${buttonClasses("secondary", "md")}`}
          >
            Browse open rooms
          </Link>
        </div>
      </div>
    );
  }

  const seat = await getMySeat(invite.roomId, user.id);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="You're invited" />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold leading-snug">{invite.title}</h2>
          <Badge tone="success">Open</Badge>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {invite.focusTag && <Badge>{invite.focusTag}</Badge>}
          <Badge tone="info">
            {invite.capacity} seat{invite.capacity === 1 ? "" : "s"}
          </Badge>
        </div>

        {invite.description && (
          <p className="mt-3 text-sm text-muted-foreground">
            {invite.description}
          </p>
        )}

        <div className="mt-5 border-t border-border pt-5">
          {seat ? (
            <div className="space-y-3">
              <Notice tone="success" title="You already have a seat">
                This room is expecting you.
              </Notice>
              <Link
                href={`/rooms/${invite.roomId}`}
                className={buttonClasses("primary", "md")}
              >
                Enter room
              </Link>
            </div>
          ) : (
            <JoinInviteButton token={token} />
          )}
        </div>
      </div>
    </div>
  );
}
