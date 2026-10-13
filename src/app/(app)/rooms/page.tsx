import Link from "next/link";
import { Badge, Notice } from "@/components/ui/notice";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/brand";
import { listPublicRooms } from "@/lib/data/rooms";
import { MAX_CAPACITY } from "@/lib/validation/room";
import type { Room } from "@/types/database";

export const metadata = { title: "Rooms" };

export default async function RoomsPage() {
  const { rooms, occupancy, hostNames, failed } = await listPublicRooms();

  return (
    <div>
      <PageHeader
        title="Focus rooms"
        description="Open public rooms — drop in, take a seat, work alongside others."
      >
        <Link href="/rooms/create" className={buttonClasses("primary", "md")}>
          Create room
        </Link>
      </PageHeader>

      {failed && (
        <Notice tone="danger" title="Rooms unavailable">
          The room list could not be loaded. The database may be unreachable or
          the Stage 2 migrations may not be applied yet — try again shortly.
        </Notice>
      )}

      {!failed && rooms.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="font-medium">No open rooms yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first — create a room and people can drop in alongside you.
          </p>
          <Link
            href="/rooms/create"
            className={`mt-4 ${buttonClasses("secondary", "md")}`}
          >
            Create the first room
          </Link>
        </div>
      )}

      {!failed && rooms.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <RoomCard
                room={room}
                occupancy={occupancy.get(room.id) ?? 0}
                hostName={hostNames.get(room.host_user_id) ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoomCard({
  room,
  occupancy,
  hostName,
}: {
  room: Room;
  occupancy: number;
  hostName: string | null;
}) {
  const full = occupancy >= room.capacity;
  const percent = Math.min(
    Math.round((occupancy / room.capacity) * 100),
    100,
  );

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="block rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold leading-snug">{room.title}</h2>
        <Badge tone={full ? "warning" : "success"}>
          {occupancy}/{Math.min(room.capacity, MAX_CAPACITY)} seats
        </Badge>
      </div>

      {room.focus_tag && (
        <p className="mt-1.5 text-xs font-medium lowercase text-primary">
          {room.focus_tag}
        </p>
      )}

      {room.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {room.description}
        </p>
      )}

      <div className="mt-4">
        <div
          role="progressbar"
          aria-label="Seats occupied"
          aria-valuenow={occupancy}
          aria-valuemin={0}
          aria-valuemax={room.capacity}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full ${full ? "bg-danger" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {hostName ? `Hosted by ${hostName}` : "Host"} ·{" "}
          {full ? "Full" : "Seats open"}
        </p>
      </div>
    </Link>
  );
}
