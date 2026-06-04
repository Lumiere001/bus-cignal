import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MatchForDashboard = {
  matchId: string;
  reservationCode: string | null;
  status: string;
  departureAt: string;
  pricePerSeat: number;
  direction: string;
  originLabel: string;
  destinationLabel: string;
  tripId: string;
};

/** 학생의 모든 매칭을 출발 시각 가까운 순으로 반환. */
export async function getMatchesForPassenger(
  passengerId: string,
): Promise<MatchForDashboard[]> {
  const db = createAdminClient();

  // passengerId(= match_passengers.id)로 name+phone 조회
  const { data: thisMp } = await db
    .from("match_passengers")
    .select("name, phone")
    .eq("id", passengerId)
    .maybeSingle();

  if (!thisMp) return [];

  // phone + name 으로 묶어 전체 매칭 조회 (V1 정책: 동일 이름·전화 = 같은 학생)
  const { data: allMps } = await db
    .from("match_passengers")
    .select("match_id")
    .eq("phone", thisMp.phone)
    .eq("name", thisMp.name);

  const matchIds = (allMps ?? []).map((m) => m.match_id);
  if (!matchIds.length) return [];

  // matches 조회
  const { data: matchRows } = await db
    .from("matches")
    .select("id, reservation_code, status, trip_id")
    .in("id", matchIds);

  if (!matchRows?.length) return [];

  // trips 조회
  const tripIds = [...new Set(matchRows.map((m) => m.trip_id))];
  const { data: tripRows } = await db
    .from("trips")
    .select(
      "id, departure_at, price_per_seat, direction, origin_location_id, destination_location_id",
    )
    .in("id", tripIds);

  if (!tripRows?.length) return [];

  // region_locations 조회
  const locIds = [
    ...new Set(
      tripRows.flatMap((t) => [t.origin_location_id, t.destination_location_id]),
    ),
  ];
  const { data: locRows } = await db
    .from("region_locations")
    .select("id, address, label")
    .in("id", locIds);

  const tripMap = new Map(tripRows.map((t) => [t.id, t]));
  const locMap = new Map((locRows ?? []).map((l) => [l.id, l]));

  const results: MatchForDashboard[] = [];
  for (const m of matchRows) {
    const trip = tripMap.get(m.trip_id);
    if (!trip) continue;

    const origin = locMap.get(trip.origin_location_id);
    const dest = locMap.get(trip.destination_location_id);

    results.push({
      matchId: m.id,
      reservationCode: m.reservation_code,
      status: m.status,
      departureAt: trip.departure_at,
      pricePerSeat: trip.price_per_seat,
      direction: trip.direction,
      originLabel: origin?.label ?? origin?.address ?? "출발지",
      destinationLabel: dest?.label ?? dest?.address ?? "도착지",
      tripId: trip.id,
    });
  }

  // 출발 시각 가까운 순 (오름차순)
  results.sort(
    (a, b) =>
      new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime(),
  );

  return results;
}
