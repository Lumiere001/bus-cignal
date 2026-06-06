import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_SHORT, TRIP_STATUS_COLOR, TRIP_STATUS_LABEL } from "@/lib/labels";
import { formatKstShort } from "@/lib/datetime";

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
export default async function AdminTripsPage() {
  const trips = await loadTrips();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전체 차량</h1>
        <p className="text-muted-foreground mt-1 text-sm">전국 운행 {trips.length}건 · 출발 임박순 (읽기)</p>
      </div>

      {trips.length === 0 ? (
        <p className="text-muted-foreground text-sm">등록된 차량이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">공급 지구</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">방향</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">출발</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">정원</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">요금</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{t.supply?.name ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{DIRECTION_SHORT[t.direction]}</td>
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatKstShort(t.departure_at)}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{t.capacity}석</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{t.price_per_seat.toLocaleString("ko-KR")}원</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TRIP_STATUS_COLOR[t.status]}`}>
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
