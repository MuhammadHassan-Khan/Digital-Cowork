import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { InitialsAvatar, PageHeader } from "@/components/ui/brand";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/notice";
import { InvitePanel } from "@/components/rooms/invite-panel";
import {
  CloseRoomButton,
  JoinRoomButton,
  LeaveRoomButton,
  RemoveSeatButton,
} from "@/components/rooms/room-actions";
import { SeatHeartbeat } from "@/components/rooms/seat-heartbeat";
import { requireUserWithProfile } from "@/lib/auth/session";
import {
  getMySeat,
  getProfileName,
  listRoomInvites,
  listRoomOccupants,
  loadRoom,
} from "@/lib/data/rooms";
import { toInviteViews } from "@/lib/rooms/invite-views";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/validation/profile";

export const metadata = { title: "Room" };

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;
  const { user } = await requireUserWithProfile();

  const roomResult = await loadRoom(id);
  if (roomResult.status === "not_found") notFound();
  if (roomResult.status === "error") {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Room" />
        <Notice tone="danger" title="Could not load this room">
          The database may be unreachable or the Stage 2 migrations may not be
          applied yet. Try again in a moment.
        </Notice>
        <Link
          href="/rooms"
          className={`mt-4 inline-block ${buttonClasses("secondary", "md")}`}
        >
          Back to rooms
        </Link>
      </div>
    );
  }

  const room = roomResult.room;
  const isHost = room.host_user_id === user.id;
  const isClosed = room.status === "closed";

  const [mySeat, occupantsResult, hostName, invites, headerStore] =
    await Promise.all([
      getMySeat(room.id, user.id),
      listRoomOccupants(room.id),
      getProfileName(room.host_user_id),
      isHost ? listRoomInvites(room.id) : Promise.resolve([]),
      headers(),
    ]);
  const seated = Boolean(mySeat);
  const occupants = occupantsResult.occupants;

  // Origin for copyable invite links (display only; derived server-side so
  // the client panel renders purely).
  const origin = `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host") ?? "localhost:3000"}`;
  const inviteData = invites ? toInviteViews(invites) : null;

  return (
    <div>
      <PageHeader
        title={room.title}
        description={
          room.description || "A focused coworking room — take a seat and work."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {room.focus_tag && <Badge>{room.focus_tag}</Badge>}
          <Badge tone={room.visibility === "private" ? "warning" : "info"}>
            {room.visibility === "private" ? "Private" : "Public"}
          </Badge>
          {isClosed && <Badge tone="danger">Closed</Badge>}
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column: occupants + seating */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">In the room</h2>
              <span className="text-sm text-muted-foreground">
                {occupants.length}/{room.capacity} seats
              </span>
            </div>

            {occupantsResult.failed && (
              <Notice tone="danger" className="mt-4">
                The participant list could not be loaded.
              </Notice>
            )}

            {!occupantsResult.failed && occupants.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Nobody here yet — take the first seat.
              </p>
            )}

            {!occupantsResult.failed && occupants.length > 0 && (
              <ul className="mt-4 space-y-3">
                {occupants.map((occupant) => {
                  const isYou = occupant.user_id === user.id;
                  const isRoomHost = occupant.user_id === room.host_user_id;
                  const name =
                    occupant.profile?.display_name ?? "Member";
                  return (
                    <li
                      key={occupant.user_id}
                      className="flex items-center gap-3"
                    >
                      <InitialsAvatar name={name} className="size-9 text-xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {name}
                          {isYou && (
                            <span className="text-muted-foreground"> (you)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isRoomHost
                            ? "Host"
                            : occupant.profile
                              ? EXPERIENCE_LEVEL_LABELS[
                                  occupant.profile.experience_level
                                ]
                              : "Member"}
                        </p>
                      </div>
                      {isHost && !isYou && (
                        <div className="ml-auto">
                          <RemoveSeatButton
                            roomId={room.id}
                            targetUserId={occupant.user_id}
                            targetName={name}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-6 border-t border-border pt-5">
              {isClosed ? (
                <Notice tone="warning" title="This room is closed">
                  The host ended the session — no one can join right now.
                </Notice>
              ) : seated ? (
                <div className="flex flex-wrap items-center gap-3">
                  <LeaveRoomButton roomId={room.id} />
                  <span className="text-xs text-muted-foreground">
                    Your seat is held while this page is open.
                  </span>
                </div>
              ) : (
                <JoinRoomButton roomId={room.id} />
              )}
            </div>

            {seated && <SeatHeartbeat roomId={room.id} />}
          </section>

          <section className="rounded-xl border border-dashed border-border bg-card p-6">
            <h2 className="font-semibold">Live session</h2>
            <Notice tone="info" className="mt-3">
              Voice, video, chat and screen sharing switch on when LiveKit
              connects — the next build stage. This screen currently manages
              presence and capacity: seats, host controls and invite links are
              fully enforced server-side.
            </Notice>
          </section>
        </div>

        {/* Side column: details + host controls */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Room details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Host</dt>
                <dd className="font-medium">{hostName ?? "Unknown"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Seats</dt>
                <dd className="font-medium">{room.capacity}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Visibility</dt>
                <dd className="font-medium capitalize">{room.visibility}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">
                  {new Date(room.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
            {isHost && (
              <div className="mt-4 border-t border-border pt-4">
                <CloseRoomButton
                  roomId={room.id}
                  alreadyClosed={isClosed}
                />
              </div>
            )}
          </section>

          {isHost && (
            <InvitePanel
              roomId={room.id}
              origin={origin}
              invites={inviteData?.views ?? []}
              activeCount={inviteData?.activeCount ?? 0}
              invitesLoadFailed={invites === null}
            />
          )}

          {!isHost && room.visibility === "private" && seated && (
            <Notice tone="info">
              This is a private room — only people with the host&apos;s invite
              link can join.
            </Notice>
          )}
        </aside>
      </div>
    </div>
  );
}
