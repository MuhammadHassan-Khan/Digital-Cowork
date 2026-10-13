/**
 * Seat-reservation timing constants shared by server and client.
 *
 * The SQL side (`reserve_room_seat`) writes `interval '15 minutes'`; if you
 * change SEAT_TTL_MINUTES, change the migration too — they must agree.
 *
 * Stage 3 replaces this schedule with a LiveKit presence heartbeat
 * (ARCHITECTURE §3); until then, the client renews while the room page is
 * open so active members are never dropped mid-session, and abandoned
 * reservations free themselves after the TTL.
 */
export const SEAT_TTL_MINUTES = 15;
export const SEAT_TTL_MS = SEAT_TTL_MINUTES * 60_000;

/** How often the open room page renews its seat (must be < SEAT_TTL_MS). */
export const SEAT_HEARTBEAT_MS = 5 * 60_000;
