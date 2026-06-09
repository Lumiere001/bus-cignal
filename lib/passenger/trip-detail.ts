import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type TripDetail = {
  tripId: string;
  direction: string;
  departureAt: string;
  pricePerSeat: number;
  originLabel: string;
  originAddress: string;
  originLat: number | null;
  originLng: number | null;
  destinationLabel: string;
  destinationAddress: string;
  destinationLat: number | null;
  destinationLng: number | null;
  operatorName: string | null;
  operatorPhone: string | null;
  treasurerName: string | null;
  treasurerPhone: string | null;
};

/** passengerId가 소유한 tripId의 탑승 장소 상세 정보를 반환. 소유권 없으면 null. */
export async function getTripForPassenger(
  passengerId: string,
  tripId: string,
): Promise<TripDetail | null> {
  const db = createAdminClient();

  // 1. passengerId → name+phone (V1 정책: 동일 이름+전화 = 같은 학생)
  const { data: thisMp } = await db
    .from("match_passengers")
    .select("name, phone")
    .eq("id", passengerId)
    .maybeSingle();

  if (!thisMp) return null;

  // 2. 동일 name+phone의 모든 match_id
  const { data: allMps } = await db
    .from("match_passengers")
    .select("match_id")
    .eq("phone", thisMp.phone)
    .eq("name", thisMp.name);

  const matchIds = (allMps ?? []).map((m) => m.match_id);
  if (!matchIds.length) return null;

  // 3. 소유한 매칭 중 tripId에 해당하는 것 확인 (소유권 검증)
  const { data: matchRow } = await db
    .from("matches")
    .select("id")
    .in("id", matchIds)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!matchRow) return null;

  // 4. trip 정보 조회
  const { data: trip } = await db
    .from("trips")
    .select(
      "id, departure_at, price_per_seat, direction, origin_location_id, destination_location_id, created_by, treasurer_name, treasurer_phone",
    )
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return null;

  // 5. 탑승/하차 위치 좌표 및 주소 조회
  const { data: locRows } = await db
    .from("region_locations")
    .select("id, address, label, lat, lng")
    .in("id", [trip.origin_location_id, trip.destination_location_id]);

  const locMap = new Map((locRows ?? []).map((l) => [l.id, l]));
  const origin = locMap.get(trip.origin_location_id);
  const dest = locMap.get(trip.destination_location_id);

  // 6. 담당(공급) 간사 연락처 — trip.created_by. 학생 탑승 안내 목적(§S5·§10.2).
  let operator: { name: string | null; phone: string | null } | null = null;
  if (trip.created_by) {
    const { data } = await db
      .from("operators")
      .select("name, phone")
      .eq("id", trip.created_by)
      .maybeSingle();
    operator = data;
  }

  return {
    tripId: trip.id,
    direction: trip.direction,
    departureAt: trip.departure_at,
    pricePerSeat: trip.price_per_seat,
    originLabel: origin?.label ?? origin?.address ?? "출발지",
    originAddress: origin?.address ?? "",
    originLat: origin?.lat ?? null,
    originLng: origin?.lng ?? null,
    destinationLabel: dest?.label ?? dest?.address ?? "도착지",
    destinationAddress: dest?.address ?? "",
    destinationLat: dest?.lat ?? null,
    destinationLng: dest?.lng ?? null,
    operatorName: operator?.name ?? null,
    operatorPhone: operator?.phone ?? null,
    treasurerName: trip.treasurer_name ?? null,
    treasurerPhone: trip.treasurer_phone ?? null,
  };
}
