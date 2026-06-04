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
    trips: { regions: { name: string } | null } | null; // 공급 지구
  } | null;
};

async function loadRejections(): Promise<Row[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("rejection_log")
    .select(
      "id, reason, created_at, seat_requests ( seat_count, regions ( name ), trips ( regions ( name ) ) )",
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
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">시각</th>
                <th className="px-4 py-2 font-medium">공급 지구</th>
                <th className="px-4 py-2 font-medium">신청 지구</th>
                <th className="px-4 py-2 font-medium">인원</th>
                <th className="px-4 py-2 font-medium">사유</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                    {formatKstShort(r.created_at)}
                  </td>
                  <td className="px-4 py-2">{r.seat_requests?.trips?.regions?.name ?? "—"}</td>
                  <td className="px-4 py-2">{r.seat_requests?.regions?.name ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{r.seat_requests?.seat_count ?? "—"}</td>
                  <td className="text-muted-foreground px-4 py-2">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
