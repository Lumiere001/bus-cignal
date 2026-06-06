import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { createAdminClient } from "@/lib/supabase/admin";
import { buttonVariants } from "@/components/ui/button";
import { DIRECTION_SHORT } from "@/lib/labels";
import { formatKstDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 간사 대시보드 (1-B 통합) — 우리 지구 운영 현황을 한 화면에 인라인으로.
// 공급 차량·보낸 신청을 클릭 없이 바로 보여주고, 카드 클릭 시 해당 화면으로 이동.

const ACTIVE_MATCH = ["awaiting_payment", "payment_reported", "paid"];

type SupplyTrip = {
  id: string;
  direction: "up" | "down";
  route: string;
  departureAt: string;
  capacity: number;
  available: number;
  queued: number;
};

async function loadDashboard(regionId: string) {
  const db = createAdminClient();

  const { data: trips } = await db
    .from("trips")
    .select(
      `id, direction, departure_at, capacity, status,
       origin:region_locations!origin_location_id(label, address),
       destination:region_locations!destination_location_id(label, address),
       seat_offers(seat_count, status),
       matches(id, status)`,
    )
    .eq("operator_region_id", regionId)
    .eq("status", "published")
    .order("departure_at", { ascending: true });

  const tripIds = (trips ?? []).map((t) => t.id);

  // 우리 차량별 대기(queued) 신청 수 + 우리 지구가 보낸 신청 상태별 집계
  const [queuedRows, sentRows] = await Promise.all([
    tripIds.length
      ? db.from("seat_requests").select("trip_id").in("trip_id", tripIds).eq("status", "queued")
      : Promise.resolve({ data: [] as { trip_id: string }[] }),
    db.from("seat_requests").select("status").eq("region_id", regionId),
  ]);

  const queuedByTrip = new Map<string, number>();
  for (const r of (queuedRows.data ?? []) as { trip_id: string }[]) {
    queuedByTrip.set(r.trip_id, (queuedByTrip.get(r.trip_id) ?? 0) + 1);
  }

  const one = <T,>(v: T | T[]): T | undefined => (Array.isArray(v) ? v[0] : v);
  const supplyTrips: SupplyTrip[] = (trips ?? []).map((t) => {
    const origin = one(t.origin) as { label: string | null; address: string | null } | undefined;
    const dest = one(t.destination) as { label: string | null; address: string | null } | undefined;
    const openSeats = (t.seat_offers ?? [])
      .filter((o) => o.status === "open")
      .reduce((s, o) => s + o.seat_count, 0);
    const active = (t.matches ?? []).filter((m) => ACTIVE_MATCH.includes(m.status ?? "")).length;
    return {
      id: t.id,
      direction: t.direction as "up" | "down",
      route: `${origin?.label ?? origin?.address ?? "출발지"} → ${dest?.label ?? dest?.address ?? "도착지"}`,
      departureAt: t.departure_at,
      capacity: t.capacity,
      available: Math.max(0, openSeats - active),
      queued: queuedByTrip.get(t.id) ?? 0,
    };
  });

  const sent = { total: 0, queued: 0, matched: 0, done: 0, rejected: 0 };
  for (const r of (sentRows.data ?? []) as { status: string }[]) {
    sent.total++;
    if (r.status === "queued") sent.queued++;
    else if (r.status === "matched") sent.matched++;
    else if (r.status === "rejected") sent.rejected++;
    else sent.done++;
  }

  const activeMatches = (trips ?? [])
    .flatMap((t) => t.matches ?? [])
    .filter((m) => ACTIVE_MATCH.includes(m.status ?? "")).length;
  const totalQueued = [...queuedByTrip.values()].reduce((a, b) => a + b, 0);

  return { supplyTrips, sent, activeMatches, totalQueued };
}

export default async function OperatorDashboardPage() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold">간사 대시보드</h1>
        <p className="text-destructive mt-4 rounded-lg border px-3 py-2 text-sm">
          소속 지구가 아직 배정되지 않았습니다.
        </p>
      </main>
    );
  }

  const [regionName, d] = await Promise.all([
    getOperatorRegionName(session.regionId),
    loadDashboard(session.regionId),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* 헤더 + 진입점 통일 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{regionName} 운영 현황</h1>
          <p className="text-muted-foreground mt-1 text-sm">간사 대시보드</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/operator/trips/new"
            className={cn(buttonVariants({ size: "sm" }), "h-10 px-4")}
          >
            ＋ 차량 등록
          </Link>
          <Link
            href="/operator/requests/new"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-card h-10 px-4")}
          >
            ＋ 타지구 신청
          </Link>
        </div>
      </div>

      {/* ① 우리 지구 공급 차량 — 인라인, 카드 클릭 시 상세로 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            공개 차량 <span className="text-muted-foreground">{d.supplyTrips.length}</span>
            {d.totalQueued > 0 && (
              <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                대기 신청 {d.totalQueued}
              </span>
            )}
          </h2>
          <Link href="/operator/trips" className="text-primary text-xs font-medium hover:underline">
            전체 차량 →
          </Link>
        </div>

        {d.supplyTrips.length === 0 ? (
          <Link
            href="/operator/trips/new"
            className="text-muted-foreground hover:border-primary/40 hover:text-foreground block rounded-xl border border-dashed py-10 text-center text-sm transition-colors"
          >
            아직 공개한 차량이 없습니다. ＋ 차량 등록하기
          </Link>
        ) : (
          <ul className="space-y-2">
            {d.supplyTrips.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/operator/trips/${t.id}`}
                  className="bg-card hover:border-primary/50 flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          t.direction === "up"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {DIRECTION_SHORT[t.direction]}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatKstDateTime(t.departureAt)} 출발
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">{t.route}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      정원 {t.capacity}석 · 잔여 {t.available}석
                    </p>
                  </div>
                  {t.queued > 0 ? (
                    <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-amber-800">
                      대기 {t.queued}명 →
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 shrink-0 text-xs whitespace-nowrap">
                      대기 없음
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ② 우리 지구가 보낸 신청 — 인라인 요약, 클릭 시 신청 목록 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            보낸 신청 <span className="text-muted-foreground">{d.sent.total}</span>
          </h2>
          <Link href="/operator/requests" className="text-primary text-xs font-medium hover:underline">
            신청 목록 →
          </Link>
        </div>
        <Link
          href="/operator/requests"
          className="bg-card hover:border-primary/50 grid grid-cols-4 gap-2 rounded-xl border p-4 shadow-sm transition-colors"
        >
          {[
            { label: "대기", value: d.sent.queued, tone: "text-amber-700" },
            { label: "매칭", value: d.sent.matched, tone: "text-emerald-700" },
            { label: "완료", value: d.sent.done, tone: "text-foreground" },
            { label: "거절", value: d.sent.rejected, tone: "text-muted-foreground" },
          ].map((c) => (
            <div key={c.label} className="text-center">
              <p className={`text-xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{c.label}</p>
            </div>
          ))}
        </Link>
      </section>

      {/* ③ 진행 요약 — 매칭·정산 바로가기 */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/operator/matches"
          className="bg-card hover:border-primary/50 rounded-xl border p-4 shadow-sm transition-colors"
        >
          <p className="text-muted-foreground text-xs">진행중 매칭</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{d.activeMatches}</p>
          <p className="text-primary mt-1 text-xs font-medium">송금·예약 관리 →</p>
        </Link>
        <Link
          href="/operator/settlement"
          className="bg-card hover:border-primary/50 rounded-xl border p-4 shadow-sm transition-colors"
        >
          <p className="text-muted-foreground text-xs">정산</p>
          <p className="mt-1 text-2xl font-bold">🧾</p>
          <p className="text-primary mt-1 text-xs font-medium">받을·보낼 정산표 →</p>
        </Link>
      </section>
    </main>
  );
}
