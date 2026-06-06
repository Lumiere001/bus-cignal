import { requireOperator } from "@/lib/auth/operator";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { formatKstDateTime } from "@/lib/datetime";
import { BoardingGroups, type BoarderRow } from "./BoardingGroups";

export const dynamic = "force-dynamic";

// 타지구 학생이 점유하는(=활성) 매칭 상태만 모은다. 입금확인(paid)은 확정 탑승,
// 나머지(awaiting_payment·payment_reported)는 진행 중 — chip으로 구분 표기.
// expired/cancelled는 탑승자가 아니므로 제외.
const ACTIVE_MATCH_STATUSES: string[] = ["awaiting_payment", "payment_reported", "paid"];

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

  // 우리 지구가 공급한 차량(trip.operator_region_id = 우리 지구)에 매칭된 타지구 학생만.
  // DB 레벨 스코핑 — trip 임베드의 operator_region_id로 inner 필터해 over-fetch·타지구 PII 유입 방지.
  const { data: rows } = await supabase
    .from("matches")
    .select(
      `
      id, status, reservation_code, matched_at,
      passenger:request_passengers!passenger_id(name, phone, school_or_role),
      request:seat_requests!request_id(
        operator_id,
        region:regions!region_id(id, name)
      ),
      trip:trips!trip_id!inner(
        operator_region_id, direction, departure_at,
        origin:region_locations!origin_location_id(label, address),
        destination:region_locations!destination_location_id(label, address)
      )
    `,
    )
    .eq("trip.operator_region_id", session.regionId)
    .in("status", ACTIVE_MATCH_STATUSES)
    .order("matched_at", { ascending: false });

  // 신청 지구 담당 간사 연락처 — 그룹 헤더의 "담당 간사 ○○○ 010-…" 표기용.
  // 매칭된 신청들의 operator_id를 한 번에 묶어 조회(중복 제거) → 맵으로 룩업.
  // (운영 연락 목적 풀 노출, 팀장 승인 — trips/[id] operatorContacts 패턴과 동일)
  const requestOperatorIds = [
    ...new Set(
      (rows ?? [])
        .map((m) => one(m.request)?.operator_id)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const operatorContacts = new Map<string, { name: string | null; phone: string | null }>();
  if (requestOperatorIds.length > 0) {
    const { data: operators } = await supabase
      .from("operators")
      .select("id, name, phone")
      .in("id", requestOperatorIds);
    for (const op of operators ?? []) {
      operatorContacts.set(op.id, { name: op.name, phone: op.phone });
    }
  }

  // 임베드 관계를 서버에서 정규화해 직렬화 가능한 행으로 좁힌다(클라 그룹 컴포넌트로 전달).
  // 전화번호는 풀 노출(간사 운영 연락용, 팀장 승인 — trips/[id] 패턴 일관).
  const boarders: BoarderRow[] = (rows ?? []).map((m) => {
    const trip = one(m.trip);
    const origin = one(trip?.origin);
    const dest = one(trip?.destination);
    const pax = one(m.passenger);
    const req = one(m.request);
    const region = one(req?.region);
    const contact = req?.operator_id ? operatorContacts.get(req.operator_id) : undefined;
    const direction = (trip?.direction ?? "down") as "up" | "down";
    const route = `${origin?.label ?? origin?.address ?? "출발지"} → ${
      dest?.label ?? dest?.address ?? "도착지"
    }`;

    return {
      id: m.id,
      status: m.status ?? "",
      reservationCode: m.reservation_code ?? null,
      direction,
      route,
      departure: trip ? formatKstDateTime(trip.departure_at) : "",
      studentName: pax?.name ?? "학생",
      schoolOrRole: pax?.school_or_role ?? null,
      phone: pax?.phone ?? null,
      regionId: region?.id ?? "unknown",
      regionName: region?.name ?? "타지구",
      operatorName: contact?.name ?? null,
      operatorPhone: contact?.phone ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold">우리 버스 탄 타지구 학생</h1>
      <p className="mb-2 text-xs text-gray-400">
        {regionName} 차량에 매칭된 타지구 학생을 신청 지구별로 모았습니다 · 담당 간사와 연락해
        탑승을 조율하세요.
      </p>
      <p className="mb-6 text-xs text-gray-400">
        채팅은 지구별이 아니라 차량(상/하행)별 방에서 진행됩니다 · 각 Trip 상세에서 입장하세요.
      </p>

      <BoardingGroups boarders={boarders} />
    </div>
  );
}
