import { createAdminClient } from "@/lib/supabase/admin";
import { formatKstShort } from "@/lib/datetime";

export const dynamic = "force-dynamic";

// SPEC §5.11 — 거절 발생 단순 목록(V1). 임계값·통계는 V2.
// 소스 = rejection_log(거절 시각·사유) ← seat_requests(인원·신청지구·공급지구).

type Row = {
  id: string;
  reason: string;
  created_at: string;
  seat_requests: {
    seat_count: number;
    regions: { name: string } | null; // 신청 지구
    trips: { regions: { name: string } | null } | null; // 공급 지구 (trip 배정 신청)
    wait_region: { name: string } | null; // 공급 지구 (대기큐 거절 — trip_id null)
  } | null;
};

async function loadRejections(): Promise<Row[]> {
  const db = createAdminClient();
  // seat_requests→regions FK가 2개(region_id·wait_region_id)라 임베드는 FK 힌트 필수.
  const { data } = await db
    .from("rejection_log")
    .select(
      "id, reason, created_at, seat_requests ( seat_count, regions!region_id ( name ), trips ( regions ( name ) ), wait_region:regions!wait_region_id ( name ) )",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as Row[] | null) ?? [];
}

/** UTC ISO → "MM/DD HH:mm" (KST). */
export default async function AdminRejectionsPage() {
  const rows = await loadRejections();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">거절 발생</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          공급 지구가 거절한 신청 — 최근 {rows.length}건 (V1 단순 목록)
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">거절 기록이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">시각</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">공급 지구</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">신청 지구</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">인원</th>
                <th className="px-4 py-2 font-medium">사유</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                    {formatKstShort(r.created_at)}
                  </td>
                  {/* 대기큐 거절 건(trip=null)은 거절 주체 = wait_region_id 지구로 폴백 표기 */}
                  <td className="px-4 py-2 whitespace-nowrap">
                    {r.seat_requests?.trips?.regions?.name ??
                      (r.seat_requests?.wait_region
                        ? `${r.seat_requests.wait_region.name} (대기큐)`
                        : "—")}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{r.seat_requests?.regions?.name ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{r.seat_requests?.seat_count ?? "—"}</td>
                  <td className="text-muted-foreground px-4 py-2 min-w-[12rem]">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
