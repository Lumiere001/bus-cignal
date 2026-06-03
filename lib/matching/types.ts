export type TripStatus = "draft" | "published" | "closed";
export type MatchStatus =
  | "awaiting_payment"
  | "payment_reported"
  | "paid"
  | "expired"
  | "cancelled";
export type RequestStatus = "queued" | "partially_matched" | "fully_matched" | "rejected";

export interface Trip {
  id: string;
  capacity: number;
  status: TripStatus;
  departure_at: string;
  direction: string;
  price_per_seat: number;
  operator_region_id: string;
  origin_location_id: string;
  destination_location_id: string;
  note: string | null;
}

export interface RequestPassenger {
  id: string;
  request_id: string;
  name: string;
  phone: string;
  priority: number;
  school_or_role: string | null;
  note: string | null;
}

export interface SeatRequest {
  id: string;
  trip_id: string;
  operator_id: string;
  region_id: string;
  requested_at: string;
  status: RequestStatus;
  seat_count: number;
  passengers: RequestPassenger[];
}

export interface Match {
  id: string;
  trip_id: string;
  request_id: string;
  passenger_id: string;
  status: MatchStatus;
  matched_at: string;
  paid_at: string | null;
  payment_reported_at: string | null;
  cancellation_source: string | null;
  cancellation_reason: string | null;
  reservation_code: string | null;
}

export interface ApproveResult {
  matches: Match[];
  remainingSeats: number;
}

export const MatchingError = {
  NOT_ENOUGH_SEATS: "NOT_ENOUGH_SEATS",
  EMPTY_SELECTION: "EMPTY_SELECTION",
  INVALID_PASSENGER: "INVALID_PASSENGER",
} as const;

export type MatchingErrorCode = (typeof MatchingError)[keyof typeof MatchingError];

export class MatchingException extends Error {
  constructor(public readonly code: MatchingErrorCode) {
    super(code);
    this.name = "MatchingException";
  }
}
