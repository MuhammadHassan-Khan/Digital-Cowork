import { PageHeader } from "@/components/ui/brand";
import { RoomForm } from "@/components/rooms/room-form";

export const metadata = { title: "Create room" };

export default function CreateRoomPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Create a room"
        description="Public rooms appear in the directory; private ones are reachable only through your invite link."
      />
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <RoomForm />
      </div>
    </div>
  );
}
