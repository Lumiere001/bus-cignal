import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DIRECTION_SHORT,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_COLOR,
  MATCH_STATUS_LABEL,
} from "@/lib/labels";
import { MatchingQueue } from "./MatchingQueue";
import { MatchActions } from "./MatchActions";

// 매칭으로 자리를 점유하는 상태 (잔여 계산 시 차감)
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

function formatKST(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOperator();
  const supabase = createAdminClient();

  // 본인 지구 공급 trip만 — operator_region_id 필터로 소유권 가드
  const { data: trip } = await supabase
    .from("trips")
    .select(
      `
      id, direction, departure_at, capacity, price_per_seat, status, note,
      origin:region_locations!origin_location_id(label, address),
      destination:region_locations!destination_location_id(label, address),
      seat_offers(seat_count, status),
      matches(
        id, status, payment_due_at, matched_at, reservation_code, passenger_id,
        passenger:request_passengers!passenger_id(name, school_or_role),
        request:seat_requests!request_id(region:regions!region_id(name))
      )
    `,
    )
    .eq("id", id)
    .eq("operator_region_id", session.regionId!)
    .single();

  if (!trip) notFound();

  // 대기 신청 (시각순 — FIFO 표시, 강제 아님. priority는 힌트)
  const { data: requests } = await supabase
    .from("seat_requests")
    .select(
      `
      id, requested_at, seat_count, status,
      region:regions!region_id(name, code),
      request_passengers(id, name, phone, school_or_role, priority, note)
    `,
    )
    .eq("trip_id", id)
    .eq("status", "queued")
    .order("requested_at", { ascending: true });

  const origin = one(trip.origin);
  const dest = one(trip.destination);
  const status = trip.status as "draft" | "published" | "closed";
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

  // 신청 큐 → 클라이언트 컴포넌트용 직렬화 (전화번호는 뒤 4자리만 — 개인정보 최소, §2.4)
  const queue = (requests ?? [])
    .map((r) => ({
      id: r.id,
      requestedAt: r.requested_at,
      regionName: one(r.region)?.name ?? "타지구",
      passengers: (r.request_passengers ?? [])
        .filter((p) => !matchedPassengerIds.has(p.id))
        .sort((a, b) => a.priority - b.priority)
        .map((p) => ({
          id: p.id,
          name: p.name,
          phoneTail: p.phone.slice(-4),
          schoolOrRole: p.school_or_role,
          priority: p.priority,
          note: p.note,
        })),
    }))
    .filter((r) => r.passengers.length > 0); // 남은 학생 없는 신청 카드는 숨김

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 뒤로 */}
      <Link
        href="/operator/trips"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← Trip 목록
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
            {formatKST(trip.departure_at)} 출발
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
        {(trip.matches ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
            아직 매칭된 학생이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {(trip.matches ?? [])
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.matched_at).getTime() - new Date(a.matched_at).getTime(),
              )
              .map((m) => {
                const p = one(m.passenger);
                const region = one(one(m.request)?.region);
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {p?.name ?? "학생"}
                      </span>
                      {p?.school_or_role && (
                        <span className="ml-2 text-gray-400">{p.school_or_role}</span>
                      )}
                      {region?.name && (
                        <span className="ml-2 text-xs text-gray-400">
                          · {region.name}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {MATCH_STATUS_LABEL[m.status ?? ""] ?? m.status}
                      </span>
                      <MatchActions
                        matchId={m.id}
                        status={m.status ?? ""}
                        reservationCode={m.reservation_code ?? null}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
