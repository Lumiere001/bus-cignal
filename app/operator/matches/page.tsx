import { requireOperator } from "@/lib/auth/operator";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { formatKstDateTime } from "@/lib/datetime";
import { MatchesList, type MatchRow } from "./MatchesList";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          소속 지구 정보가 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    );
  }

  const regionName = await getOperatorRegionName(session.regionId);
  const supabase = createAdminClient();

  // 본인 지구가 신청 주체인 매칭만 — DB 레벨 스코핑(전국 over-fetch·타지구 PII 유입 방지).
  const { data: myReqs } = await supabase
    .from("seat_requests")
    .select("id")
    .eq("region_id", session.regionId);
  const reqIds = (myReqs ?? []).map((r) => r.id);

  const rows = reqIds.length
    ? (
        await supabase
          .from("matches")
          .select(
            `
      id, status, reservation_code, matched_at,
      passenger:request_passengers!passenger_id(name, school_or_role),
      request:seat_requests!request_id(region_id),
      trip:trips!trip_id(
        direction, departure_at, price_per_seat,
        origin:region_locations!origin_location_id(label, address),
        destination:region_locations!destination_location_id(label, address),
        supply:regions!operator_region_id(name)
      )
    `,
          )
          .in("request_id", reqIds)
          .order("matched_at", { ascending: false })
      ).data
    : null;

  // 임베드 관계를 서버에서 정규화해 직렬화 가능한 행으로 좁힌다(클라 목록 컴포넌트로 전달).
  const matches: MatchRow[] = (rows ?? []).map((m) => {
    const trip = one(m.trip);
    const origin = one(trip?.origin);
    const dest = one(trip?.destination);
    const supply = one(trip?.supply);
    const pax = one(m.passenger);
    const direction = (trip?.direction ?? "down") as "up" | "down";
    const route = `${origin?.label ?? origin?.address ?? "출발지"} → ${
      dest?.label ?? dest?.address ?? "도착지"
    }`;
    const departure = trip ? formatKstDateTime(trip.departure_at) : "";

    return {
      id: m.id,
      status: m.status ?? "",
      reservationCode: m.reservation_code ?? null,
      direction,
      studentName: pax?.name ?? "학생",
      route,
      departure,
      pricePerSeat: trip?.price_per_seat ?? null,
      supplyName: supply?.name ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold">{regionName} 신청</h1>
      <p className="mb-6 text-xs text-gray-400">
        우리 지구 학생이 타지구 차량에 매칭된 건 · 송금 완료 보고 후 공급 지구의 입금 확인을
        기다립니다.
      </p>

      <MatchesList matches={matches} />
    </div>
  );
}
