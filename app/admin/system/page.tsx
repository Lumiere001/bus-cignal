import { createAdminClient } from "@/lib/supabase/admin";
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

export default async function AdminSystemPage() {
  const rows = await loadConfig();
  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? null;

  const maintenanceOn = get(MAINTENANCE_KEY) === "on";
  const deadline = kstDate(get(REQUEST_DEADLINE_KEY));
  const anonymize = kstDate(get(ANONYMIZE_KEY));

  const logRows = rows.filter((r) => !INTERNAL_KEYS.has(r.key));

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">시스템 설정</h1>
        <p className="text-muted-foreground mt-1 text-sm">점검 모드 · 신청 마감일 · 데이터 익명화</p>
      </div>

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
