"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { renewSeatAction } from "@/lib/actions/rooms";
import { SEAT_HEARTBEAT_MS } from "@/lib/rooms/constants";

/**
 * Keeps the member's seat alive while the room page stays open (Stage 2
 * stand-in for LiveKit presence; Stage 3 replaces this with real
 * heartbeat/disconnect reconciliation — ARCHITECTURE §3).
 *
 * If renewal ever fails (seat expired, room closed), the page is refreshed
 * so the UI truthfully reflects the server's state instead of pretending.
 */
export function SeatHeartbeat({ roomId }: { roomId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function beat() {
      try {
        const result = await renewSeatAction(roomId);
        if (!cancelled && !result.ok) router.refresh();
      } catch {
        // Transient failure — the next beat retries; TTL gives slack.
      }
    }

    const timer = window.setInterval(() => {
      void beat();
    }, SEAT_HEARTBEAT_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void beat();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [roomId, router]);

  return null;
}
