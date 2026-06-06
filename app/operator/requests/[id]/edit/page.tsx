import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_SHORT } from "@/lib/labels";
import { one } from "@/lib/supabase/relation";
import { formatKstDateTime } from "@/lib/datetime";
import { RequestEditForm } from "./RequestEditForm";

export const dynamic = "force-dynamic";

// 간사 신청 수정 — 본인 지구 대기(queued)·매칭 없음 신청만. 명단 전면 편집.
// 가드는 서버 액션(updateRequest)에서도 재검증하지만, UI도 미리 차단해 헛수고 방지.

type Passenger = {
  id: string;
  name: string;
  phone: string;
  school_or_role: string | null;
  note: string | null;
  priority: number;
};
type Request = {
  id: string;
  region_id: string;
  status: string;
  trip: {
    direction: "up" | "down";
    departure_at: string;
    price_per_seat: number;
    region: { name: string } | null;
  } | null;
  request_passengers: Passenger[];
};

export default async function RequestEditPage({
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
      id, region_id, status,
      trip:trips!trip_id(
        direction, departure_at, price_per_seat,
        region:regions!operator_region_id(name)
      ),
      request_passengers(id, name, phone, school_or_role, note, priority)
    `,
    )
    .eq("id", id)
    .maybeSingle();

  const req = data as Request | null;
  // 본인 지구가 보낸 신청만 — 그 외(없음·타지구)는 404
  if (!req || req.region_id !== session.regionId) notFound();

  // 수정 불가(대기 아님 or 진행 중 매칭) → 안내 + 돌아가기.
  let editable = req.status === "queued";
  if (editable) {
    const { data: activeMatches } = await db
      .from("matches")
      .select("id")
      .eq("request_id", req.id)
      .in("status", ["awaiting_payment", "payment_reported", "paid"])
      .limit(1);
    if (activeMatches && activeMatches.length > 0) editable = false;
  }

  const trip = one(req.trip);

  if (!editable) {
    return (
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <Link
            href={`/operator/requests/${req.id}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            ← 신청 상세
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">신청 수정</h1>
        </div>
        <p className="text-muted-foreground rounded-xl border px-4 py-6 text-center text-sm">
          수정할 수 없는 신청입니다 (이미 처리됨).
        </p>
      </main>
    );
  }

  const passengers = [...req.request_passengers].sort((a, b) => a.priority - b.priority);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/operator/requests/${req.id}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← 신청 상세
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">신청 수정</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {trip?.region?.name ?? "?"} 차량 · {trip ? DIRECTION_SHORT[trip.direction] : "—"} · 대기중
        </p>
      </div>

      {/* 차량 정보는 수정 불가(읽기 전용) */}
      <section className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">신청 차량</h2>
        {trip ? (
          <p className="mt-1 text-xs text-gray-600">
            {trip.region?.name ?? "?"} · {DIRECTION_SHORT[trip.direction]} ·{" "}
            {formatKstDateTime(trip.departure_at)} 출발 ·{" "}
            {trip.price_per_seat.toLocaleString("ko-KR")}원/인
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-600">차량 정보를 불러올 수 없습니다.</p>
        )}
        <p className="mt-1 text-xs text-gray-400">차량은 변경할 수 없습니다. 학생 명단만 수정됩니다.</p>
      </section>

      <RequestEditForm
        requestId={req.id}
        initialPassengers={passengers.map((p) => ({
          name: p.name,
          phone: p.phone,
          schoolOrRole: p.school_or_role ?? "",
          note: p.note ?? "",
        }))}
      />
    </main>
  );
}
