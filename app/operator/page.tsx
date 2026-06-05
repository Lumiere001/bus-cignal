import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 간사 대시보드 — 본인 지구 운영 현황 요약 + 바로가기 (SPEC §4.3).

const ACTIVE_MATCH = ["awaiting_payment", "payment_reported", "paid"];

async function loadSummary(regionId: string) {
  const db = createAdminClient();

  // 본인 지구가 공급한 trip id 목록 (매칭/대기 집계에 사용)
  const { data: myTrips } = await db
    .from("trips")
    .select("id, status")
    .eq("operator_region_id", regionId);
  const tripIds = (myTrips ?? []).map((t) => t.id);
  const publishedTrips = (myTrips ?? []).filter((t) => t.status === "published").length;

  const [incomingQueued, myRequests, activeMatches] = await Promise.all([
    // 우리 차량으로 들어온 대기중 신청 (승인 처리 필요)
    tripIds.length
      ? db
          .from("seat_requests")
          .select("*", { count: "exact", head: true })
          .in("trip_id", tripIds)
          .eq("status", "queued")
      : Promise.resolve({ count: 0 }),
    // 우리 지구가 보낸 신청
    db.from("seat_requests").select("*", { count: "exact", head: true }).eq("region_id", regionId),
    // 우리 차량 관련 진행중 매칭
    tripIds.length
      ? db
          .from("matches")
          .select("*", { count: "exact", head: true })
          .in("trip_id", tripIds)
          .in("status", ACTIVE_MATCH)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    publishedTrips,
    incomingQueued: incomingQueued.count ?? 0,
    myRequests: myRequests.count ?? 0,
    activeMatches: activeMatches.count ?? 0,
  };
}

export default async function OperatorDashboardPage() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold">간사 대시보드</h1>
        <p className="text-destructive mt-4 rounded-lg border px-3 py-2 text-sm">
          소속 지구가 아직 배정되지 않았습니다. 마스터 승인 후 이용할 수 있습니다.
        </p>
      </main>
    );
  }

  const s = await loadSummary(session.regionId);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">간사 대시보드</h1>
        <p className="text-muted-foreground mt-1 text-sm">본인 지구 운영 현황</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="공개중 차량"
          value={s.publishedTrips}
          href="/operator/trips"
          icon="🚌"
          tone="info"
        />
        <StatCard
          label="대기중 신청"
          value={s.incomingQueued}
          href="/operator/trips"
          icon="⏳"
          tone={s.incomingQueued > 0 ? "warning" : "neutral"}
          hint={s.incomingQueued > 0 ? "승인 대기 →" : undefined}
        />
        <StatCard
          label="보낸 신청"
          value={s.myRequests}
          href="/operator/requests"
          icon="📤"
          tone="neutral"
        />
        <StatCard
          label="진행중 매칭"
          value={s.activeMatches}
          href="/operator/matches"
          icon="✅"
          tone={s.activeMatches > 0 ? "success" : "neutral"}
          hint={s.activeMatches > 0 ? "정산까지 순항" : undefined}
        />
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          href="/operator/trips/new"
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
        >
          ＋ 차량 등록
        </Link>
        <Link
          href="/operator/requests/new"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-card h-11 px-5")}
        >
          ＋ 타지구 차량 신청
        </Link>
      </section>
    </main>
  );
}
