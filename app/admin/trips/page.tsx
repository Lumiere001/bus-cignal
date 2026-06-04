import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_SHORT, TRIP_STATUS_COLOR, TRIP_STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

// SPEC §4.4 — 마스터 전국 Trip 목록(읽기 모니터링). 출발 임박순.

type Row = {
  id: string;
  direction: "up" | "down";
  departure_at: string;
  capacity: number;
  price_per_seat: number;
  status: "draft" | "published" | "closed";
  supply: { name: string } | null;
};

async function loadTrips(): Promise<Row[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("trips")
    .select(
      "id, direction, departure_at, capacity, price_per_seat, status, supply:regions!operator_region_id(name)",
    )
    .order("departure_at", { ascending: true });
  return (data as Row[] | null) ?? [];
}

/** UTC ISO → 'MM/DD HH:mm' (KST). */
function fmtKst(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return `${k.slice(5, 7)}/${k.slice(8, 10)} ${k.slice(11, 16)}`;
}

export default async function AdminTripsPage() {
  const trips = await loadTrips();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전체 Trip</h1>
        <p className="text-muted-foreground mt-1 text-sm">전국 운행 {trips.length}건 · 출발 임박순 (읽기)</p>
      </div>

      {trips.length === 0 ? (
        <p className="text-muted-foreground text-sm">등록된 Trip이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium">공급 지구</th>
                <th className="px-4 py-2 font-medium">방향</th>
                <th className="px-4 py-2 font-medium">출발</th>
                <th className="px-4 py-2 font-medium">정원</th>
                <th className="px-4 py-2 font-medium">요금</th>
                <th className="px-4 py-2 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{t.supply?.name ?? "—"}</td>
                  <td className="px-4 py-2">{DIRECTION_SHORT[t.direction]}</td>
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">{fmtKst(t.departure_at)}</td>
                  <td className="px-4 py-2 tabular-nums">{t.capacity}석</td>
                  <td className="px-4 py-2 tabular-nums">{t.price_per_seat.toLocaleString("ko-KR")}원</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TRIP_STATUS_COLOR[t.status]}`}>
                      {TRIP_STATUS_LABEL[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
