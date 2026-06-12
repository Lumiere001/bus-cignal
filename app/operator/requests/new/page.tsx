import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { one } from "@/lib/supabase/relation";
import { RequestWizard, type WizardTrip, type RegionOption } from "./RequestWizard";

export const dynamic = "force-dynamic";

const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

export default async function Page() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          소속 지구 정보가 없어 신청할 수 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();
  const myRegionName = await getOperatorRegionName(session.regionId);

  // 타지구(다른 지구) 공개 차량만 — 본인 지구 차량 제외.
  // origin/destination 의 lat,lng 와 공급지구명까지 임베드 → 위저드 지도/조회 조건에 사용.
  const { data: trips } = await supabase
    .from("trips")
    .select(
      `
      id, direction, departure_at, price_per_seat,
      origin:region_locations!origin_location_id(label, address, lat, lng),
      destination:region_locations!destination_location_id(label, address, lat, lng),
      region:regions!operator_region_id(name, area),
      seat_offers(seat_count, status),
      matches(id, status)
    `,
    )
    .eq("status", "published")
    .neq("operator_region_id", session.regionId)
    .order("departure_at", { ascending: true });

  const wizardTrips: WizardTrip[] = (trips ?? []).map((t) => {
    const origin = one(t.origin);
    const dest = one(t.destination);
    const openSeats = (t.seat_offers ?? [])
      .filter((o) => o.status === "open")
      .reduce((sum, o) => sum + o.seat_count, 0);
    const activeMatches = (t.matches ?? []).filter((m) =>
      (ACTIVE_MATCH_STATUSES as readonly string[]).includes(m.status ?? ""),
    ).length;
    const direction: "up" | "down" = t.direction === "down" ? "down" : "up";
    // 지도 핀 = '지역(우리 동네)' 지점 — 가는편은 출발지(지역), 오는편은 도착지(지역).
    // 평창 쪽 지점은 좌표 없음(오는편 출발=텍스트)/고정이라 핀 대신 텍스트로만 안내.
    const local = direction === "up" ? origin : dest;
    return {
      id: t.id,
      direction,
      departureAt: t.departure_at,
      pricePerSeat: t.price_per_seat,
      regionName: one(t.region)?.name ?? "타지구",
      regionArea: one(t.region)?.area ?? null,
      originLabel: origin?.label ?? origin?.address ?? "출발지",
      destinationLabel: dest?.label ?? dest?.address ?? "도착지",
      mapLabel:
        local?.label ?? local?.address ?? (direction === "up" ? "출발지" : "도착지"),
      mapLat: local?.lat ?? null,
      mapLng: local?.lng ?? null,
      availableSeats: Math.max(0, openSeats - activeMatches),
    };
  });

  // 출발 지구 선택지 = 전체 지구(본인 지구 제외, 가나다순). 공급 차량이 없는 지구도
  // 선택 가능해야 "아직 버스를 안 올린 지구" 대기큐에 신청을 넣을 수 있다.
  // id는 대기 신청(createWaitRequest) 대상 지구 해석용.
  const { data: regions } = await supabase
    .from("regions")
    .select("id, name, area")
    .neq("id", session.regionId);

  const regionOptions: RegionOption[] = (regions ?? [])
    .map((r) => ({ id: r.id, name: r.name, area: r.area }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/operator/requests"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← 신청 목록
      </Link>
      <h1 className="mb-1 text-xl font-semibold">타지구 차량 신청</h1>
      <p className="mb-6 text-xs text-gray-400">신청 주체: {myRegionName} (수요)</p>

      <RequestWizard trips={wizardTrips} regionOptions={regionOptions} />
    </div>
  );
}
