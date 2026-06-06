import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { TripsSearch } from "./TripsSearch";
import type { TripRow } from "./TripsSearch";

export const dynamic = "force-dynamic";

// SPEC §4.4 — 마스터 전국 차량 목록(읽기 모니터링). 출발 임박순.
// 검색·필터는 클라이언트(TripsSearch)에서 처리하므로 여기선 전 행을 직렬화해 전달.

// 활성(자리 점유) 매칭 — 잔여석 계산용. operator 대시보드와 동일 집합.
const ACTIVE_MATCH: string[] = ["awaiting_payment", "payment_reported", "paid"];

type LocationRel = { label: string | null; address: string | null };

type QueryRow = {
  id: string;
  direction: "up" | "down";
  departure_at: string;
  capacity: number;
  price_per_seat: number;
  status: "draft" | "published" | "closed";
  supply: { name: string } | { name: string }[] | null;
  origin: LocationRel | LocationRel[] | null;
  destination: LocationRel | LocationRel[] | null;
  seat_offers: { seat_count: number; status: string }[] | null;
  matches: { id: string; status: string | null }[] | null;
};

function locationLabel(rel: LocationRel | LocationRel[] | null, fallback: string): string {
  const loc = one(rel);
  return loc?.label ?? loc?.address ?? fallback;
}

async function loadTrips(): Promise<TripRow[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("trips")
    .select(
      `id, direction, departure_at, capacity, price_per_seat, status,
       supply:regions!operator_region_id(name),
       origin:region_locations!origin_location_id(label, address),
       destination:region_locations!destination_location_id(label, address),
       seat_offers(seat_count, status),
       matches(id, status)`,
    )
    .order("departure_at", { ascending: true });

  const rows = (data as QueryRow[] | null) ?? [];
  return rows.map((t): TripRow => {
    const openSeats = (t.seat_offers ?? [])
      .filter((o) => o.status === "open")
      .reduce((s, o) => s + (o.seat_count ?? 0), 0);
    const active = (t.matches ?? []).filter((m) =>
      ACTIVE_MATCH.includes(m.status ?? ""),
    ).length;
    return {
      id: t.id,
      direction: t.direction,
      departureAt: t.departure_at,
      capacity: t.capacity,
      remaining: Math.max(0, openSeats - active),
      pricePerSeat: t.price_per_seat,
      status: t.status,
      regionName: one(t.supply)?.name ?? null,
      originLabel: locationLabel(t.origin, "출발지"),
      destLabel: locationLabel(t.destination, "도착지"),
    };
  });
}

export default async function AdminTripsPage() {
  const trips = await loadTrips();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전체 차량</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          전국 운행 {trips.length}건 · 출발 임박순 (읽기)
        </p>
      </div>

      <TripsSearch rows={trips} />
    </main>
  );
}
