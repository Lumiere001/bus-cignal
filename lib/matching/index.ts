import {
  type ApproveResult,
  type Match,
  type MatchStatus,
  MatchingError,
  MatchingException,
  type SeatRequest,
} from "./types";

const ACTIVE_STATUSES: MatchStatus[] = [
  "awaiting_payment",
  "payment_reported",
  "paid",
];

// 정렬만 수행. status 필터(queued만 보이기 등)는 caller 책임.
export function queue(requests: SeatRequest[]): SeatRequest[] {
  return [...requests].sort(
    (a, b) =>
      new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime(),
  );
}

// openSeatCount = sum(open seat_offers.seat_count) — 공개한 좌석만. trip.capacity(총 정원) X.
export function available(openSeatCount: number, existingMatches: Match[]): number {
  const activeCount = existingMatches.filter((m) =>
    ACTIVE_STATUSES.includes(m.status as MatchStatus),
  ).length;
  return Math.max(0, openSeatCount - activeCount);
}

// request 상태 전이(전원 선택 → matched / 부분 선택 → queued 잔류)는 caller 책임.
// 이 함수는 Match 생성과 잔여 자리 계산만 수행.
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
