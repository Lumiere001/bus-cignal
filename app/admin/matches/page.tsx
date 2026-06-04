import { createAdminClient } from "@/lib/supabase/admin";
import { MATCH_STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

// SPEC §4.4 — 마스터 전국 매칭 목록(읽기 모니터링). 최근 매칭순.
// 개인정보 최소: 학생 이름·전화 노출 안 함(지구·상태·금액·시각만).

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

type Row = {
  id: string;
  status: string;
  matched_at: string;
  trip: { price_per_seat: number; supply: { name: string } | null } | null;
  request: { region: { name: string } | null } | null;
};

async function loadMatches() {
  const db = createAdminClient();
  const { data } = await db
    .from("matches")
    .select(
      `
      id, status, matched_at,
      trip:trips!trip_id(price_per_seat, supply:regions!operator_region_id(name)),
      request:seat_requests!request_id(region:regions!region_id(name))
    `,
    )
    .order("matched_at", { ascending: false })
    .limit(200);
  return (data as Row[] | null) ?? [];
}

function fmtKst(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return `${k.slice(5, 7)}/${k.slice(8, 10)} ${k.slice(11, 16)}`;
}

export default async function AdminMatchesPage() {
  const matches = await loadMatches();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전체 매칭</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          전국 매칭 최근 {matches.length}건 · 매칭순 (읽기, 학생 개인정보 비노출)
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">매칭 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">공급 지구</th>
                <th className="px-4 py-2 font-medium">신청 지구</th>
                <th className="px-4 py-2 font-medium">금액</th>
                <th className="px-4 py-2 font-medium">상태</th>
                <th className="px-4 py-2 font-medium">매칭 시각</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => {
                const trip = one(m.trip);
                const request = one(m.request);
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{one(trip?.supply ?? null)?.name ?? "—"}</td>
                    <td className="px-4 py-2">{one(request?.region ?? null)?.name ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {trip ? `${trip.price_per_seat.toLocaleString("ko-KR")}원` : "—"}
                    </td>
                    <td className="px-4 py-2">{MATCH_STATUS_LABEL[m.status] ?? m.status}</td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">{fmtKst(m.matched_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
