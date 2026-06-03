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

/** 학생의 모든 매칭을 출발 시각 가까운 순으로 반환. sessionToken을 DB hash와 검증. */
export async function getMatchesForPassenger(
  matchPassengerId: string,
  sessionToken: string,
): Promise<MatchForDashboard[]> {
  const db = createAdminClient();

  // name, phone, access_token_hash 함께 조회
  const { data: thisMp } = await db
    .from("match_passengers")
    .select("name, phone, access_token_hash")
    .eq("id", matchPassengerId)
    .maybeSingle();

  if (!thisMp) return [];

  // JWT의 sessionToken을 SHA-256 해시해서 DB의 access_token_hash와 비교
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sessionToken),
  );
  const computedHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!thisMp.access_token_hash || computedHash !== thisMp.access_token_hash)
    return [];

  // phone 단독 조회 → name+phone 튜플로 좁혀 phone 충돌 시 타인 매칭 노출 방지
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
