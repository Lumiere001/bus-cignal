import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// SPEC §5.9 — 전국 대시보드 + 익명화 D-day.
// 집계는 service_role(createAdminClient)로 head count 쿼리(=row 미전송, 카운트만).

const ACTIVE_MATCH = ["awaiting_payment", "payment_reported", "paid"];

/** 오늘(KST) 0시의 UTC ISO — '오늘 거절' 필터 경계. */
function startOfTodayKstUtc(): string {
  const kstDate = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${kstDate}T00:00:00+09:00`).toISOString();
}

async function loadStats() {
  const db = createAdminClient();
  const todayStart = startOfTodayKstUtc();

  const [trips, matches, rejections, pending, cfg] = await Promise.all([
    db.from("trips").select("*", { count: "exact", head: true }).eq("status", "published"),
    db.from("matches").select("*", { count: "exact", head: true }).in("status", ACTIVE_MATCH),
    db
      .from("rejection_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart),
    db
      .from("operators")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    db.from("system_config").select("value").eq("key", "anonymize_after").maybeSingle(),
  ]);

  return {
    activeTrips: trips.count ?? 0,
    activeMatches: matches.count ?? 0,
    rejectionsToday: rejections.count ?? 0,
    pendingOperators: pending.count ?? 0,
    anonymizeAfter: cfg.data?.value ?? null,
  };
}

/** 익명화일까지 남은 일수 (오늘 기준 올림). */
function ddayLabel(iso: string | null): { line: string; dday: string } | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const days = Math.ceil((target.getTime() - Date.now()) / 86_400_000);
  return {
    line: `${target.toISOString().slice(0, 10)} 자동 익명화`,
    dday: days >= 0 ? `D-${days}` : `D+${-days}`,
  };
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <div className="hover:border-primary rounded-xl border p-4 transition-colors">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminDashboardPage() {
  const s = await loadStats();
  const anon = ddayLabel(s.anonymizeAfter);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전국 대시보드</h1>
        <p className="text-muted-foreground mt-1 text-sm">CCC 전국 여름 수련회 — 운영 현황</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="활성 Trip" value={s.activeTrips} href="/admin/trips" />
        <Stat label="활성 매칭" value={s.activeMatches} href="/admin/matches" />
        <Stat label="거절 발생 (오늘)" value={s.rejectionsToday} href="/admin/rejections" />
        <Stat label="가입 대기 간사" value={s.pendingOperators} href="/admin/operators/pending" />
      </section>

      <section className="rounded-xl border p-5">
        <h2 className="text-sm font-semibold">데이터 익명화</h2>
        {anon ? (
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-muted-foreground text-sm">{anon.line}</span>
            <span className="text-lg font-bold tabular-nums">{anon.dday}</span>
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            익명화 예정일 미설정 (<code>system_config.anonymize_after</code>) — 수련회 종료 후 설정
          </p>
        )}
      </section>
    </main>
  );
}
