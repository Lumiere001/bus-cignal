import { describe, expect, it } from "vitest";
import { approve, available, queue } from "./index";
import { MatchingError, MatchingException } from "./types";
import type { Match, RequestPassenger, SeatRequest, Trip } from "./types";

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: "trip-1",
  capacity: 10,
  status: "published",
  departure_at: "2026-07-30T14:00:00+09:00",
  direction: "down",
  price_per_seat: 35000,
  operator_region_id: "region-1",
  origin_location_id: "loc-1",
  destination_location_id: "loc-2",
  note: null,
  ...overrides,
});

const makePassenger = (overrides: Partial<RequestPassenger> = {}): RequestPassenger => ({
  id: "p-1",
  request_id: "req-1",
  name: "김학생",
  phone: "01012341234",
  priority: 1,
  school_or_role: null,
  note: null,
  ...overrides,
});

const makeRequest = (overrides: Partial<SeatRequest> = {}): SeatRequest => ({
  id: "req-1",
  trip_id: "trip-1",
  operator_id: "op-1",
  region_id: "region-2",
  requested_at: "2026-07-01T10:00:00+09:00",
  status: "queued",
  seat_count: 3,
  passengers: [
    makePassenger({ id: "p-1", priority: 1 }),
    makePassenger({ id: "p-2", name: "이학생", priority: 2 }),
    makePassenger({ id: "p-3", name: "박학생", priority: 3 }),
  ],
  ...overrides,
});

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: "match-1",
  trip_id: "trip-1",
  request_id: "req-1",
  passenger_id: "p-1",
  status: "awaiting_payment",
  matched_at: "2026-07-01T11:00:00+09:00",
  paid_at: null,
  payment_reported_at: null,
  cancellation_source: null,
  cancellation_reason: null,
  reservation_code: null,
  ...overrides,
});

// ─── queue ────────────────────────────────────────────────────────────────────

describe("queue", () => {
  it("requested_at 오름차순으로 정렬한다", () => {
    const requests: SeatRequest[] = [
      makeRequest({ id: "req-3", requested_at: "2026-07-01T12:00:00+09:00" }),
      makeRequest({ id: "req-1", requested_at: "2026-07-01T10:00:00+09:00" }),
      makeRequest({ id: "req-2", requested_at: "2026-07-01T11:00:00+09:00" }),
    ];
    const result = queue(requests);
    expect(result.map((r) => r.id)).toEqual(["req-1", "req-2", "req-3"]);
  });

  it("이미 정렬된 상태로 넣어도 동일하게 반환한다", () => {
    const requests: SeatRequest[] = [
      makeRequest({ id: "req-1", requested_at: "2026-07-01T10:00:00+09:00" }),
      makeRequest({ id: "req-2", requested_at: "2026-07-01T11:00:00+09:00" }),
    ];
    const result = queue(requests);
    expect(result.map((r) => r.id)).toEqual(["req-1", "req-2"]);
  });

  it("빈 배열을 넣으면 빈 배열을 반환한다", () => {
    expect(queue([])).toEqual([]);
  });

  it("원본 배열을 변경하지 않는다", () => {
    const requests: SeatRequest[] = [
      makeRequest({ id: "req-2", requested_at: "2026-07-01T11:00:00+09:00" }),
      makeRequest({ id: "req-1", requested_at: "2026-07-01T10:00:00+09:00" }),
    ];
    queue(requests);
    expect(requests[0].id).toBe("req-2");
  });
});

// ─── available ────────────────────────────────────────────────────────────────

describe("available", () => {
  it("매칭이 없으면 capacity 전체를 반환한다", () => {
    expect(available(makeTrip({ capacity: 10 }), [])).toBe(10);
  });

  it("awaiting_payment 매칭은 카운트한다", () => {
    const matches = [
      makeMatch({ id: "m-1", status: "awaiting_payment" }),
      makeMatch({ id: "m-2", status: "awaiting_payment" }),
      makeMatch({ id: "m-3", status: "awaiting_payment" }),
    ];
    expect(available(makeTrip({ capacity: 10 }), matches)).toBe(7);
  });

  it("paid + cancelled 혼합 시 cancelled는 카운트하지 않는다", () => {
    const matches = [
      makeMatch({ id: "m-1", status: "paid" }),
      makeMatch({ id: "m-2", status: "paid" }),
      makeMatch({ id: "m-3", status: "cancelled" }),
      makeMatch({ id: "m-4", status: "cancelled" }),
      makeMatch({ id: "m-5", status: "cancelled" }),
    ];
    expect(available(makeTrip({ capacity: 10 }), matches)).toBe(8);
  });

  it("payment_reported + expired 혼합 시 expired는 카운트하지 않는다", () => {
    const matches = [
      makeMatch({ id: "m-1", status: "payment_reported" }),
      makeMatch({ id: "m-2", status: "expired" }),
      makeMatch({ id: "m-3", status: "expired" }),
    ];
    expect(available(makeTrip({ capacity: 10 }), matches)).toBe(9);
  });

  it("available이 0 미만이 되지 않는다", () => {
    const matches = Array.from({ length: 15 }, (_, i) =>
      makeMatch({ id: `m-${i}`, status: "paid" }),
    );
    expect(available(makeTrip({ capacity: 10 }), matches)).toBe(0);
  });

  it("모든 자리가 차면 0을 반환한다", () => {
    const matches = Array.from({ length: 10 }, (_, i) =>
      makeMatch({ id: `m-${i}`, status: "paid" }),
    );
    expect(available(makeTrip({ capacity: 10 }), matches)).toBe(0);
  });
});

// ─── approve ─────────────────────────────────────────────────────────────────

describe("approve", () => {
  it("정상: 선택한 승객 수만큼 Match를 반환하고 status는 awaiting_payment", () => {
    const request = makeRequest();
    const result = approve(request, ["p-1", "p-2"], 5);
    expect(result.matches).toHaveLength(2);
    expect(result.matches.every((m) => m.status === "awaiting_payment")).toBe(true);
  });

  it("정상: 일부만 선택하면 나머지는 건드리지 않는다 (자동 거절 없음)", () => {
    const request = makeRequest();
    const result = approve(request, ["p-1"], 5);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].passenger_id).toBe("p-1");
  });

  it("정상: 반환된 Match의 trip_id·request_id가 올바르다", () => {
    const request = makeRequest({ id: "req-99", trip_id: "trip-99" });
    const result = approve(request, ["p-1"], 5);
    expect(result.matches[0].trip_id).toBe("trip-99");
    expect(result.matches[0].request_id).toBe("req-99");
  });

  it("정상: remainingSeats가 올바르게 계산된다", () => {
    const request = makeRequest();
    const result = approve(request, ["p-1", "p-2"], 5);
    expect(result.remainingSeats).toBe(3);
  });

  it("정상: 딱 available 수만큼 선택하면 remainingSeats는 0", () => {
    const request = makeRequest();
    const result = approve(request, ["p-1", "p-2", "p-3"], 3);
    expect(result.remainingSeats).toBe(0);
    expect(result.matches).toHaveLength(3);
  });

  it("에러: selectedPassengerIds 빈 배열 → EMPTY_SELECTION", () => {
    const request = makeRequest();
    expect(() => approve(request, [], 5)).toThrow(MatchingException);
    expect(() => approve(request, [], 5)).toThrow(MatchingError.EMPTY_SELECTION);
  });

  it("에러: 자리보다 많이 선택 → NOT_ENOUGH_SEATS", () => {
    const request = makeRequest();
    expect(() => approve(request, ["p-1", "p-2", "p-3"], 2)).toThrow(
      MatchingError.NOT_ENOUGH_SEATS,
    );
  });

  it("에러: request에 없는 passenger_id 포함 → INVALID_PASSENGER", () => {
    const request = makeRequest();
    expect(() => approve(request, ["p-1", "p-unknown"], 5)).toThrow(
      MatchingError.INVALID_PASSENGER,
    );
  });

  it("에러: 전혀 다른 passenger_id만 선택 → INVALID_PASSENGER", () => {
    const request = makeRequest();
    expect(() => approve(request, ["p-999"], 5)).toThrow(
      MatchingError.INVALID_PASSENGER,
    );
  });
});
