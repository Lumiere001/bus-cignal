import { createAdminClient } from "@/lib/supabase/admin";
import { formatKstShort, startOfTodayKstUtc } from "@/lib/datetime";
import {
  FREE_DB_LIMIT_BYTES,
  type Monitoring,
  evaluateSignals,
  formatBytes,
  parseDbStats,
} from "@/lib/ops/monitoring";
import { setAnonymizeAfter, setRequestDeadline, toggleMaintenance } from "./actions";
import { ANONYMIZE_KEY, MAINTENANCE_KEY, REQUEST_DEADLINE_KEY } from "./keys";

export const dynamic = "force-dynamic";

// SPEC §2.1·§4.4 — 마스터 시스템 설정: 점검 모드·신청 마감일·익명화 예정일 + 변경 로그.
// 접근 보호 = middleware(/admin/*). 모든 변경은 서버 액션(actions.ts)에서 마스터 재검증.

// master 인증 내부 키 — 운영 설정 로그에 노출 안 함.
const INTERNAL_KEYS = new Set(["master_login_attempts", "master_lock_until"]);

const KEY_LABEL: Record<string, string> = {
  [MAINTENANCE_KEY]: "점검 모드",
  [REQUEST_DEADLINE_KEY]: "신청 마감일",
  [ANONYMIZE_KEY]: "익명화 예정일",
};

type ConfigRow = { key: string; value: string | null; updated_at: string; updated_by: string | null };

async function loadConfig(): Promise<ConfigRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("system_config")
    .select("key, value, updated_at, updated_by")
    .order("updated_at", { ascending: false });
  return (data as ConfigRow[] | null) ?? [];
}

/**
 * 운영 모니터링 집계 — DB 용량(admin_db_stats RPC) + 핵심 row 수 + 오늘 활동.
 * 전부 service_role + head-count(행 미전송, 카운트만) → PII 유입 없음.
 */
async function loadMonitoring(): Promise<Monitoring> {
  const db = createAdminClient();
  const todayStart = startOfTodayKstUtc();
  const head = { count: "exact" as const, head: true };

  const [
    stats,
    operators,
    trips,
    seatRequests,
    passengers,
    matches,
    notifications,
    todayRequests,
    todayMatches,
    todayNotifSent,
    todayNotifPending,
    todayNotifFailed,
  ] = await Promise.all([
    db.rpc("admin_db_stats"),
    db.from("operators").select("*", head),
    db.from("trips").select("*", head),
    db.from("seat_requests").select("*", head),
    db.from("request_passengers").select("*", head),
    db.from("matches").select("*", head),
    db.from("notifications").select("*", head),
    db.from("seat_requests").select("*", head).gte("created_at", todayStart),
    db.from("matches").select("*", head).gte("created_at", todayStart),
    db.from("notifications").select("*", head).gte("created_at", todayStart).eq("delivery_status", "sent"),
    db.from("notifications").select("*", head).gte("created_at", todayStart).eq("delivery_status", "pending"),
    db.from("notifications").select("*", head).gte("created_at", todayStart).eq("delivery_status", "failed"),
  ]);

  const dbStats = parseDbStats(stats.data);
  const ratio = dbStats.sizeBytes / FREE_DB_LIMIT_BYTES;
  const today = {
    requests: todayRequests.count ?? 0,
    matches: todayMatches.count ?? 0,
    notifSent: todayNotifSent.count ?? 0,
    notifPending: todayNotifPending.count ?? 0,
    notifFailed: todayNotifFailed.count ?? 0,
  };

  return {
    db: {
      sizeBytes: dbStats.sizeBytes,
      limitBytes: FREE_DB_LIMIT_BYTES,
      ratio,
      topTables: dbStats.tables.slice(0, 5),
    },
    rows: {
      operators: operators.count ?? 0,
      trips: trips.count ?? 0,
      seatRequests: seatRequests.count ?? 0,
      passengers: passengers.count ?? 0,
      matches: matches.count ?? 0,
      notifications: notifications.count ?? 0,
    },
    today,
    pro: evaluateSignals({
      dbRatio: ratio,
      todayRequests: today.requests,
      todayNotifFailed: today.notifFailed,
    }),
    generatedAt: new Date().toISOString(),
  };
}

/** UTC ISO → KST 'YYYY-MM-DD' (date input·표시용). */
function kstDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** UTC ISO → 'YYYY-MM-DD HH:mm' (KST, 로그 표시). */
function kstDateTime(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return `${k.slice(0, 10)} ${k.slice(11, 16)}`;
}

// Pro 권장 배너 — 신호 수준별 색.
const PRO_BANNER: Record<Monitoring["pro"]["level"], { box: string; title: string }> = {
  ok: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    title: "현재 무료 티어 여유 — 결제 불필요",
  },
  warn: {
    box: "border-amber-300 bg-amber-50 text-amber-900",
    title: "⚠️ Supabase Pro 결제 검토 권장",
  },
  crit: {
    box: "border-destructive/40 bg-destructive/10 text-destructive",
    title: "⚠️ Supabase Pro 결제 권장 (긴급)",
  },
};

function pct(ratio: number): string {
  const p = ratio * 100;
  if (p < 0.1) return "<0.1%";
  return `${p.toFixed(1)}%`;
}

function MonitoringSection({ mon }: { mon: Monitoring }) {
  const { db, rows, today, pro } = mon;
  const banner = PRO_BANNER[pro.level];
  const barColor =
    db.ratio >= 0.9 ? "bg-destructive" : db.ratio >= 0.8 ? "bg-amber-500" : "bg-primary";

  const rowItems: { label: string; value: number }[] = [
    { label: "간사", value: rows.operators },
    { label: "차량(Trip)", value: rows.trips },
    { label: "신청", value: rows.seatRequests },
    { label: "학생", value: rows.passengers },
    { label: "매칭", value: rows.matches },
    { label: "알림", value: rows.notifications },
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">운영 모니터링</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          DB 용량·오늘 활동 기준. 플랫폼 쿼터(연결·대역폭)는 앱이 못 읽으니 DB측 신호로 추정합니다.
        </p>
      </div>

      {/* Supabase Pro 권장 신호 */}
      <div className={`rounded-xl border p-4 ${banner.box}`}>
        <p className="text-sm font-bold">{banner.title}</p>
        {pro.signals.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {pro.signals.map((s) => (
              <li key={s.title}>
                <span className="font-semibold">{s.level === "crit" ? "🔴" : "🟠"} {s.title}</span>
                {" — "}
                <span className="opacity-90">{s.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm opacity-90">
            DB 용량·오늘 활동 모두 임계 이하입니다. 예약 오픈 대량 동시 접속이 예상되면 그때 Pro 또는 오픈
            시차 분산을 검토하세요.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* DB 용량 */}
        <div className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold">DB 용량</h3>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatBytes(db.sizeBytes)}</p>
          <p className="text-muted-foreground text-xs">
            / {formatBytes(db.limitBytes)} (Free) · {pct(db.ratio)}
          </p>
          <div className="bg-muted mt-3 h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.min(100, Math.max(1, db.ratio * 100))}%` }}
            />
          </div>
          {db.topTables.length > 0 && (
            <ul className="text-muted-foreground mt-3 space-y-0.5 text-xs">
              {db.topTables.map((t) => (
                <li key={t.name} className="flex justify-between gap-2">
                  <span className="truncate">{t.name}</span>
                  <span className="tabular-nums">{formatBytes(t.bytes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 오늘 활동 */}
        <div className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold">오늘 활동 (KST)</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">신규 신청</dt>
              <dd className="font-semibold tabular-nums">{today.requests}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">신규 매칭</dt>
              <dd className="font-semibold tabular-nums">{today.matches}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">알림 발송</dt>
              <dd className="font-semibold tabular-nums">{today.notifSent}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">알림 대기</dt>
              <dd className="tabular-nums">{today.notifPending}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">알림 실패</dt>
              <dd
                className={`font-semibold tabular-nums ${today.notifFailed > 0 ? "text-destructive" : ""}`}
              >
                {today.notifFailed}
              </dd>
            </div>
          </dl>
        </div>

        {/* 핵심 row 수 (누적) */}
        <div className="rounded-xl border p-5">
          <h3 className="text-sm font-semibold">핵심 데이터 (누적)</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {rowItems.map((it) => (
              <div key={it.label} className="flex justify-between">
                <dt className="text-muted-foreground">{it.label}</dt>
                <dd className="font-semibold tabular-nums">{it.value.toLocaleString("ko-KR")}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        집계 시각: {formatKstShort(mon.generatedAt)} · 새로고침 시 갱신
      </p>
    </section>
  );
}

export default async function AdminSystemPage() {
  const [rows, mon] = await Promise.all([loadConfig(), loadMonitoring()]);
  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? null;

  const maintenanceOn = get(MAINTENANCE_KEY) === "on";
  const deadline = kstDate(get(REQUEST_DEADLINE_KEY));
  const anonymize = kstDate(get(ANONYMIZE_KEY));

  const logRows = rows.filter((r) => !INTERNAL_KEYS.has(r.key));

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">시스템</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          운영 모니터링 · 점검 모드 · 신청 마감일 · 데이터 익명화
        </p>
      </div>

      <MonitoringSection mon={mon} />

      {/* 점검 모드 */}
      <section className="rounded-xl border p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">점검 모드</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              현재 상태:{" "}
              <span className={maintenanceOn ? "text-destructive font-semibold" : "font-semibold"}>
                {maintenanceOn ? "켜짐 (점검 중)" : "꺼짐 (정상 운영)"}
              </span>
            </p>
          </div>
          <form action={toggleMaintenance.bind(null, !maintenanceOn)}>
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                maintenanceOn
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-destructive/40 text-destructive hover:bg-destructive/10 border"
              }`}
            >
              {maintenanceOn ? "점검 모드 끄기" : "점검 모드 켜기"}
            </button>
          </form>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          ※ 켜면 간사 화면(/operator/*) 전체가 점검 안내로 차단되고, 신청 등 쓰기 동작도 막힙니다. 마스터는 계속 접근할 수 있습니다.
        </p>
      </section>

      {/* 신청 마감일 */}
      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">신청 마감일</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {deadline ? `현재: ${deadline} (그날 23:59까지)` : "설정 안 됨 (마감 없음)"}
        </p>
        <form action={setRequestDeadline} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={deadline}
            className="border-input bg-background rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            저장
          </button>
          <span className="text-muted-foreground text-xs">날짜를 비우고 저장하면 마감 해제</span>
        </form>
        <p className="text-muted-foreground mt-3 text-xs">
          ※ 마감일(그날 23:59 KST)이 지나면 새 신청이 차단됩니다. 학생 화면 차단은 팀원2 영역.
        </p>
      </section>

      {/* 익명화 예정일 */}
      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">데이터 익명화 예정일</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {anonymize ? `현재: ${anonymize}` : "설정 안 됨 — 수련회 종료 + 90일로 설정 권장"}
        </p>
        <form action={setAnonymizeAfter} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="date"
            defaultValue={anonymize}
            className="border-input bg-background rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            저장
          </button>
          <span className="text-muted-foreground text-xs">비우고 저장 시 해제</span>
        </form>
        <p className="text-muted-foreground mt-3 text-xs">
          이 날짜 이후 매일 새벽 cron이 개인정보를 익명화합니다. 대시보드 D-day와 연동됩니다.
        </p>
      </section>

      {/* 설정 변경 로그 */}
      <section className="space-y-3">
        <h2 className="font-semibold">설정 변경 로그</h2>
        {logRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">설정</th>
                  <th className="px-4 py-2 font-medium">값</th>
                  <th className="px-4 py-2 font-medium">변경 시각</th>
                  <th className="px-4 py-2 font-medium">변경자</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-4 py-2">{KEY_LABEL[r.key] ?? r.key}</td>
                    <td className="px-4 py-2">{r.value ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{kstDateTime(r.updated_at)}</td>
                    <td className="text-muted-foreground px-4 py-2">{r.updated_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
