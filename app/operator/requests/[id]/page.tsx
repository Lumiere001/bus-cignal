import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_SHORT, REQUEST_STATUS_LABEL } from "@/lib/labels";
import { one } from "@/lib/supabase/relation";
import { formatKstDateTime } from "@/lib/datetime";
import { RequestActions } from "./RequestActions";

export const dynamic = "force-dynamic";

// 간사 신청 상세 (SPEC §4.3·§S2) — 본인 지구가 보낸 신청 1건: trip 정보·학생 명단·상태.
// 본인 지구 신청만 접근(다른 지구 신청은 404). 개인정보=본인 명단이라 전체 표시 OK.

type Passenger = { id: string; name: string; phone: string; school_or_role: string | null; priority: number };
type Request = {
  id: string;
  region_id: string;
  status: string;
  reject_reason: string | null;
  requested_at: string;
  seat_count: number;
  trip: {
    direction: "up" | "down";
    departure_at: string;
    price_per_seat: number;
    region: { name: string } | null;
  } | null;
  request_passengers: Passenger[];
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireOperator();
  const { id } = await params;
  const db = createAdminClient();

  const { data } = await db
    .from("seat_requests")
    .select(
      `
      id, region_id, status, reject_reason, requested_at, seat_count,
      trip:trips!trip_id(
        direction, departure_at, price_per_seat,
        region:regions!operator_region_id(name)
      ),
      request_passengers(id, name, phone, school_or_role, priority)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  const req = data as Request | null;
  // 본인 지구가 보낸 신청만 — 그 외(없음·타지구)는 404
  if (!req || req.region_id !== session.regionId) notFound();

  const trip = one(req.trip);
  const passengers = [...req.request_passengers].sort((a, b) => a.priority - b.priority);

  // 수정·취소 가능 = 대기중 + 진행 중 매칭 없음 (서버 액션에서도 동일 가드로 재검증).
  let canModify = req.status === "queued";
  if (canModify) {
    const { data: activeMatches } = await db
      .from("matches")
      .select("id")
      .eq("request_id", req.id)
      .in("status", ["awaiting_payment", "payment_reported", "paid"])
      .limit(1);
    if (activeMatches && activeMatches.length > 0) canModify = false;
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link href="/operator/requests" className="text-muted-foreground text-sm hover:underline">
          ← 신청 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">신청 상세</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {trip?.region?.name ?? "?"} 차량 · {trip ? DIRECTION_SHORT[trip.direction] : "—"} ·{" "}
          {REQUEST_STATUS_LABEL[req.status] ?? req.status}
        </p>
      </div>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">신청 정보</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">신청 인원</dt>
            <dd className="font-medium">{req.seat_count}명</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">신청 시각</dt>
            <dd className="font-medium tabular-nums">{formatKstDateTime(req.requested_at)}</dd>
          </div>
          {trip && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">출발</dt>
                <dd className="font-medium tabular-nums">{formatKstDateTime(trip.departure_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">좌석 요금</dt>
                <dd className="font-medium tabular-nums">{trip.price_per_seat.toLocaleString("ko-KR")}원</dd>
              </div>
            </>
          )}
        </dl>
        {req.status === "rejected" && req.reject_reason && (
          <p className="text-destructive mt-3 rounded-lg border px-3 py-2 text-sm">
            거절 사유: {req.reject_reason}
          </p>
        )}
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">학생 명단 (우선순위순)</h2>
        <ol className="space-y-2">
          {passengers.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0 text-sm">
              <span>
                <span className="text-muted-foreground mr-2 tabular-nums">{p.priority}.</span>
                <span className="font-medium">{p.name}</span>
                {p.school_or_role && (
                  <span className="text-muted-foreground ml-2 text-xs">{p.school_or_role}</span>
                )}
              </span>
              <span className="text-muted-foreground tabular-nums">{p.phone}</span>
            </li>
          ))}
        </ol>
      </section>

      {canModify && <RequestActions requestId={req.id} />}
    </main>
  );
}
