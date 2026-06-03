import {
  type ApproveResult,
  type Match,
  type MatchStatus,
  MatchingError,
  MatchingException,
  type SeatRequest,
  type Trip,
} from "./types";

const ACTIVE_STATUSES: MatchStatus[] = [
  "awaiting_payment",
  "payment_reported",
  "paid",
];

export function queue(requests: SeatRequest[]): SeatRequest[] {
  return [...requests].sort(
    (a, b) =>
      new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime(),
  );
}

export function available(trip: Trip, existingMatches: Match[]): number {
  const activeCount = existingMatches.filter((m) =>
    ACTIVE_STATUSES.includes(m.status as MatchStatus),
  ).length;
  return Math.max(0, trip.capacity - activeCount);
}

export function approve(
  request: SeatRequest,
  selectedPassengerIds: string[],
  availableSeats: number,
): ApproveResult {
  if (selectedPassengerIds.length === 0) {
    throw new MatchingException(MatchingError.EMPTY_SELECTION);
  }

  const passengerIdSet = new Set(request.passengers.map((p) => p.id));
  const hasInvalid = selectedPassengerIds.some((id) => !passengerIdSet.has(id));
  if (hasInvalid) {
    throw new MatchingException(MatchingError.INVALID_PASSENGER);
  }

  if (selectedPassengerIds.length > availableSeats) {
    throw new MatchingException(MatchingError.NOT_ENOUGH_SEATS);
  }

  const now = new Date().toISOString();
  const matches: Match[] = selectedPassengerIds.map((passengerId) => ({
    id: crypto.randomUUID(),
    trip_id: request.trip_id,
    request_id: request.id,
    passenger_id: passengerId,
    status: "awaiting_payment",
    matched_at: now,
    paid_at: null,
    payment_reported_at: null,
    cancellation_source: null,
    cancellation_reason: null,
    reservation_code: null,
  }));

  return {
    matches,
    remainingSeats: availableSeats - selectedPassengerIds.length,
  };
}
