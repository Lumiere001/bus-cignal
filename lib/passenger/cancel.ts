import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const CANCELLABLE = ["awaiting_payment", "payment_reported", "paid"] as const;

export type MatchForCancel = {
  matchId: string;
  status: string;
  reservationCode: string | null;
  departureAt: string;
  originLabel: string;
  destinationLabel: string;
  /** 출발 시각 기준 D-1 이내 여부 (이미 출발한 경우 false). */
  isWithin24h: boolean;
};

export type CancelResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "wrong_state" | "db_error" };

/**
 * passengerId → name+phone → matchId 소유권 확인.
 * /me 정책과 동일: 동일 이름+전화번호의 match_passengers 범위 안에 matchId가 있으면 본인 매칭.
 */
async function isOwner(
  db: ReturnType<typeof createAdminClient>,
  passengerId: string,
  matchId: string,
): Promise<boolean> {
  const { data: thisMp } = await db
    .from("match_passengers")
    .select("name, phone")
    .eq("id", passengerId)
    .maybeSingle();

  if (!thisMp) return false;

  const { data: ownerMp } = await db
    .from("match_passengers")
    .select("id")
    .eq("name", thisMp.name)
    .eq("phone", thisMp.phone)
    .eq("match_id", matchId)
    .maybeSingle();

  return !!ownerMp;
}

/**
 * 취소 페이지 진입용: 소유권 검증 후 매칭 정보와 D-1 여부를 반환.
 * 검증 실패 또는 매칭 없으면 null.
 * now 파라미터는 테스트에서 주입 가능 (운영 코드는 new Date() 기본값 사용).
 */
export async function getMatchForCancel(
  passengerId: string,
  matchId: string,
  now: Date = new Date(),
): Promise<MatchForCancel | null> {
  const db = createAdminClient();

  if (!(await isOwner(db, passengerId, matchId))) return null;

  const { data: match } = await db
    .from("matches")
    .select("id, status, reservation_code, trip_id")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) return null;

  const { data: trip } = await db
    .from("trips")
    .select("departure_at, origin_location_id, destination_location_id")
    .eq("id", match.trip_id)
    .maybeSingle();

  if (!trip) return null;

  const locIds = [trip.origin_location_id, trip.destination_location_id].filter(
    Boolean,
  );
  const { data: locs } = await db
    .from("region_locations")
    .select("id, address, label")
    .in("id", locIds);

  const locMap = new Map((locs ?? []).map((l) => [l.id, l]));
  const origin = locMap.get(trip.origin_location_id);
  const dest = locMap.get(trip.destination_location_id);

  const diff = new Date(trip.departure_at).getTime() - now.getTime();
  const isWithin24h = diff >= 0 && diff < 24 * 60 * 60 * 1000;

  return {
    matchId: match.id,
    status: match.status,
    reservationCode: match.reservation_code,
    departureAt: trip.departure_at,
    originLabel: origin?.label ?? origin?.address ?? "출발지",
    destinationLabel: dest?.label ?? dest?.address ?? "도착지",
    isWithin24h,
  };
}

/**
 * 취소 실행: 소유권·상태를 재검증한 후 원자적으로 matches를 업데이트.
 * status IN ('awaiting_payment','payment_reported','paid') 조건이 UPDATE에 포함되어
 * 이미 cancelled/expired인 매칭은 update가 실행되지 않는다.
 */
export async function cancelMatch(
  passengerId: string,
  matchId: string,
  reason: string | null,
): Promise<CancelResult> {
  const db = createAdminClient();

  if (!(await isOwner(db, passengerId, matchId)))
    return { ok: false, reason: "unauthorized" };

  const { data: updated, error } = await db
    .from("matches")
    .update({
      status: "cancelled",
      cancellation_source: "passenger",
      cancellation_reason: reason ?? null,
    })
    .eq("id", matchId)
    .in("status", [...CANCELLABLE])
    .select("id");

  if (error) return { ok: false, reason: "db_error" };
  if (!updated?.length) return { ok: false, reason: "wrong_state" };

  // TODO: 양쪽 간사 알림 (lib/notifications 구현 후 연결)

  return { ok: true };
}
