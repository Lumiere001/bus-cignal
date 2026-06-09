import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DIRECTION_SHORT,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_COLOR,
  MATCH_STATUS_ORDER,
  type TripStatus,
} from "@/lib/labels";
import { one } from "@/lib/supabase/relation";
import { formatKstDateTime } from "@/lib/datetime";
import { MatchingQueue } from "./MatchingQueue";
import { MatchTable, type MatchRow } from "./MatchTable";
import { TripCancelButton } from "./TripCancelButton";
import { SeatCountEditButton } from "./SeatCountEditButton";

// 매칭으로 자리를 점유하는 상태 (잔여 계산 시 차감)
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOperator();
  const supabase = createAdminClient();

  // 본인 지구 공급 trip만 — operator_region_id 필터로 소유권 가드
  const { data: trip } = await supabase
    .from("trips")
    .select(
      `
      id, operator_region_id, direction, departure_at, capacity, price_per_seat, status, note,
      cancelled_at, cancellation_reason,
      origin:region_locations!origin_location_id(label, address),
      destination:region_locations!destination_location_id(label, address),
      seat_offers(seat_count, status),
      matches(
        id, status, payment_due_at, matched_at, reservation_code, passenger_id,
        passenger:request_passengers!passenger_id(name, phone, school_or_role),
        request:seat_requests!request_id(region:regions!region_id(name))
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  // 차량 상세·관리(대기 큐·매칭·인원·취소)는 그 차량을 등록한 '공급 지구' 간사만.
  // 없거나 다른 지구 차량이면 빈 404 대신 무엇 때문인지 친절히 안내한다.
  if (!trip || trip.operator_region_id !== session.regionId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Link
          href="/operator/trips"
          className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-700"
        >
          ← 지구 차량 목록
        </Link>
        <p className="text-lg font-semibold text-gray-900">
          {!trip ? "차량을 찾을 수 없어요" : "다른 지구가 등록한 차량이에요"}
        </p>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
          {!trip
            ? "이미 취소·삭제되었거나 주소가 잘못되었을 수 있어요."
            : "차량 상세·관리(대기 큐·매칭·인원 변경)는 그 차량을 등록한 공급 지구 간사만 볼 수 있어요. 우리 지구가 신청한 차편 정보는 ‘신청’ 메뉴에서 확인하세요."}
        </p>
      </div>
    );
  }

  // 대기 신청 (시각순 — FIFO 표시, 강제 아님. priority는 힌트)
  const { data: requests } = await supabase
    .from("seat_requests")
    .select(
      `
      id, requested_at, seat_count, status, operator_id,
      region:regions!region_id(name, code),
      request_passengers(id, name, phone, school_or_role, priority, note)
    `,
    )
    .eq("trip_id", id)
    .eq("status", "queued")
    .order("requested_at", { ascending: true });

  // 신청 지구 담당 간사 연락처 — 큐 헤더에 "담당 간사 ○○○ 010-…" 표기용.
  // 각 신청의 operator_id를 한 번에 묶어 조회(중복 제거) → 맵으로 룩업. (운영 연락 목적, 팀장 승인)
  // operator_id는 학생 직접 신청이면 null → 간사 신청만 추려서 연락처 조회.
  const requestOperatorIds = [
    ...new Set(
      (requests ?? [])
        .map((r) => r.operator_id)
        .filter((id): id is string => id !== null),
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

  const origin = one(trip.origin);
  const dest = one(trip.destination);
  const status = trip.status as TripStatus;
  const direction = trip.direction as "up" | "down";

  const openSeats = (trip.seat_offers ?? [])
    .filter((o) => o.status === "open")
    .reduce((sum, o) => sum + o.seat_count, 0);
  const activeMatches = (trip.matches ?? []).filter((m) =>
    (ACTIVE_MATCH_STATUSES as readonly string[]).includes(m.status ?? ""),
  );
  const availableSeats = Math.max(0, openSeats - activeMatches.length);

  // 이미 매칭된(활성) 학생은 큐에서 제외 — 재선택·이중 매칭 방지 (SPEC §S3: 매칭 안 된 학생만 잔류)
  const matchedPassengerIds = new Set(
    activeMatches.map((m) => m.passenger_id).filter(Boolean),
  );

  // 신청 큐 → 클라이언트 컴포넌트용 직렬화.
  // 전화번호는 풀 노출(간사 운영 연락 목적, 팀장 승인) — 학생·신청 지구 담당 간사 모두.
  const queue = (requests ?? [])
    .map((r) => {
      const contact = r.operator_id ? operatorContacts.get(r.operator_id) : undefined;
      return {
        id: r.id,
        requestedAt: r.requested_at,
        regionName: one(r.region)?.name ?? "타지구",
        operatorName: contact?.name ?? null,
        operatorPhone: contact?.phone ?? null,
        passengers: (r.request_passengers ?? [])
          .filter((p) => !matchedPassengerIds.has(p.id))
          .sort((a, b) => a.priority - b.priority)
          .map((p) => ({
            id: p.id,
            name: p.name,
            phone: p.phone,
            schoolOrRole: p.school_or_role,
            priority: p.priority,
            note: p.note,
          })),
      };
    })
    .filter((r) => r.passengers.length > 0); // 남은 학생 없는 신청 카드는 숨김

  // 매칭 현황 표 행 — 최근 매칭순. 전화 풀 노출(간사 운영 연락용, 팀장 승인).
  // 진행 순서로 정렬(awaiting→reported→paid→…). 입금 확인 클릭 후에도 자리가 튀지 않도록
  // 상태 우선 + matched_at desc + id 보조정렬로 결정적 순서(동률 셔플 제거).
  const matchRows: MatchRow[] = (trip.matches ?? [])
    .slice()
    .sort((a, b) => {
      const so =
        (MATCH_STATUS_ORDER[a.status ?? ""] ?? 99) - (MATCH_STATUS_ORDER[b.status ?? ""] ?? 99);
      if (so !== 0) return so;
      const t = new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime();
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    })
    .map((m) => {
      const p = one(m.passenger);
      return {
        id: m.id,
        name: p?.name ?? "학생",
        schoolOrRole: p?.school_or_role ?? null,
        phone: p?.phone ?? null,
        status: m.status ?? "",
        reservationCode: m.reservation_code ?? null,
      };
    });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 뒤로 */}
      <Link
        href="/operator/trips"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← 지구 차량 목록
      </Link>

      {/* Trip 헤더 */}
      <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {DIRECTION_SHORT[direction]}
          </span>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${TRIP_STATUS_COLOR[status]}`}
          >
            {TRIP_STATUS_LABEL[status]}
          </span>
          <span className="ml-auto text-sm text-gray-500">
            {formatKstDateTime(trip.departure_at)} 출발
          </span>
        </div>

        <div className="text-base font-semibold text-gray-900">
          {origin?.label ?? origin?.address ?? "출발지 미상"} →{" "}
          {dest?.label ?? dest?.address ?? "도착지 미상"}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
          <span>정원 {trip.capacity}석</span>
          <span className="font-medium text-gray-900">잔여 {availableSeats}석</span>
          <span>{trip.price_per_seat.toLocaleString()}원/인</span>
        </div>

        {trip.note && (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {trip.note}
          </p>
        )}

        {/* 버스(상/하행) 채팅 입장 — 이 차량 한 방에 공급 간사 + 매칭된 전 지구 학생이 함께 */}
        <Link
          href={`/chat/${trip.id}`}
          className="mt-4 inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          💬 버스 채팅 ({DIRECTION_SHORT[direction]})
        </Link>

        {/* 관리 — draft/published 에서만: 공개 인원 변경 + 차량 취소. */}
        {(status === "draft" || status === "published") && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SeatCountEditButton
                tripId={trip.id}
                currentCount={openSeats}
                matched={activeMatches.length}
                capacity={trip.capacity}
              />
            </div>
            <TripCancelButton
              tripId={trip.id}
              blockedReason={
                activeMatches.length > 0
                  ? "매칭된 학생이 있어 취소할 수 없어요. 먼저 학생들의 매칭을 취소한 뒤 차량을 취소할 수 있어요."
                  : null
              }
            />
          </>
        )}
        {status === "cancelled" && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            이 차량은 취소되었습니다
            {trip.cancellation_reason ? ` — ${trip.cancellation_reason}` : ""}.
          </p>
        )}
      </div>

      {/* 대기 큐 */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">대기 신청</h2>
          <span className="text-sm text-gray-400">{queue.length}건</span>
        </div>

        {status !== "published" ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
            공개(published) 상태의 Trip만 매칭할 수 있습니다.
          </p>
        ) : (
          <MatchingQueue tripId={trip.id} availableSeats={availableSeats} queue={queue} />
        )}
      </section>

      {/* 매칭 현황 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">매칭 현황</h2>
        {matchRows.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
            아직 매칭된 학생이 없습니다.
          </p>
        ) : (
          <MatchTable rows={matchRows} />
        )}
      </section>
    </div>
  );
}
