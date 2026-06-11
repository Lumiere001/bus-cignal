import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";

/**
 * 간사가 (구글폼/사전등록 등으로) 대신 잡아준 예약을 CCC 로그인 학생에게 보여주기 위한 조회.
 *
 * 간사 등록분은 request_passengers(이름+전화)로만 저장되고 학생 계정과 연결되어 있지 않다.
 * CCC 로그인 시 students.phone(= CCC가 준 전화)과 같은 전화의 간사-등록 탑승자를 찾아
 * 학생 허브(/s)에 "간사가 등록해준 예약"으로 노출한다. (읽기 전용 연동 — 데이터 변형 없음)
 */

export type OperatorBookedStatus =
  | "queued"
  | "awaiting_payment"
  | "payment_reported"
  | "paid";

export type OperatorBooked = {
  passengerId: string;
  status: OperatorBookedStatus;
  reservationCode: string | null;
  direction: "up" | "down";
  departureAt: string;
  regionName: string;
  originLabel: string | null;
  destLabel: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  refundPolicy: string | null;
};

// 좌석을 점유 중인(잔여 차감) 매칭 상태 — 학생에게 진행 상태로 보여줄 값들.
const ACTIVE_MATCH = ["awaiting_payment", "payment_reported", "paid"] as const;

/** 전화번호 정규화 — 숫자만 (request_passengers.phone은 숫자만 저장되어 있음). */
export function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^0-9]/g, "");
}

// PostgREST 임베드 결과(느슨한 형태) — 임베드는 단일 객체 또는 1-요소 배열로 올 수 있어 Embed<T>로 표현.
type Embed<T> = T | T[] | null;
type RawLoc = { label: string | null; address: string | null };
type RawTrip = {
  direction: string | null;
  departure_at: string | null;
  status: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  refund_policy: string | null;
  origin: Embed<RawLoc>;
  destination: Embed<RawLoc>;
  region: Embed<{ name: string | null }>;
};
type RawRequest = {
  status: string | null;
  requester_kind: string | null;
  trip: Embed<RawTrip>;
};
export type RawBookedRow = {
  id: string;
  request: Embed<RawRequest>;
  matches: { status: string | null; reservation_code: string | null }[] | null;
};

function labelOf(loc: Embed<RawLoc>): string | null {
  const l = one(loc);
  return l?.label ?? l?.address ?? null;
}

/**
 * 조회 결과 → 화면용 매핑 (순수 함수, 테스트 대상).
 *  · 간사 등록분(requester_kind='operator')만.
 *  · 신청이 거절/취소(rejected·cancelled)거나 차량이 취소면 제외.
 *  · 매칭 상태가 있으면 그 상태, 없으면 'queued'(대기).
 */
export function mapOperatorBooked(rows: RawBookedRow[]): OperatorBooked[] {
  const out: OperatorBooked[] = [];
  for (const p of rows) {
    const request = one(p.request);
    if (!request) continue;
    if (request.requester_kind !== "operator") continue; // 학생 본인 신청은 별도 노출
    if (request.status !== "queued" && request.status !== "matched") continue; // 거절·취소 제외

    const trip = one(request.trip);
    if (!trip || trip.status === "cancelled") continue;

    const matches = p.matches ?? [];
    const active = matches.find((m) => (ACTIVE_MATCH as readonly string[]).includes(m.status ?? ""));
    const status = (active?.status as OperatorBookedStatus | undefined) ?? "queued";

    out.push({
      passengerId: p.id,
      status,
      reservationCode: active?.reservation_code ?? null,
      direction: trip.direction === "down" ? "down" : "up",
      departureAt: trip.departure_at ?? "",
      regionName: one(trip.region)?.name ?? "타지구",
      originLabel: labelOf(trip.origin),
      destLabel: labelOf(trip.destination),
      bankName: trip.bank_name,
      accountNumber: trip.account_number,
      accountHolder: trip.account_holder,
      refundPolicy: trip.refund_policy,
    });
  }
  return out;
}

/**
 * 전화번호로 간사-등록 예약 조회. CCC 학생 전화(students.phone) 기준.
 * 전화가 없거나 형식 미달이면 빈 배열 (연동 불가 — 조용히 미표시).
 */
/** 숫자 전화 → 저장됐을 수 있는 후보 형식들(숫자만 = 앱 기본, 표준 하이픈 = 레거시/시드). */
export function phoneCandidates(digits: string): string[] {
  const out = new Set([digits]);
  if (digits.length === 11) out.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
  if (digits.length === 10) out.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
  return [...out];
}

export async function getOperatorBookedByPhone(phone: string | null | undefined): Promise<OperatorBooked[]> {
  const digits = normalizePhone(phone);
  if (digits.length < 10) return [];

  const db = createAdminClient();
  // 저장 형식이 숫자만(앱 기본)이거나 하이픈 포함(레거시)일 수 있어 둘 다 매칭.
  const orFilter = phoneCandidates(digits)
    .map((c) => `phone.eq.${c}`)
    .join(",");
  const { data } = await db
    .from("request_passengers")
    .select(
      `
      id,
      request:seat_requests!request_id(
        status, requester_kind,
        trip:trips!trip_id(
          direction, departure_at, status, bank_name, account_number, account_holder, refund_policy,
          origin:region_locations!origin_location_id(label, address),
          destination:region_locations!destination_location_id(label, address),
          region:regions!operator_region_id(name)
        )
      ),
      matches:matches!passenger_id(status, reservation_code)
    `,
    )
    .or(orFilter)
    .is("declined_at", null);

  return mapOperatorBooked((data ?? []) as unknown as RawBookedRow[]);
}
