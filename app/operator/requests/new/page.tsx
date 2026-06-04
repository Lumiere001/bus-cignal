import Link from "next/link";
import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTION_SHORT } from "@/lib/labels";
import { NewRequestForm } from "./NewRequestForm";

const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function formatKST(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

export default async function Page() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          소속 지구 정보가 없어 신청할 수 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  // 타지구(다른 지구) 공개 차량만 — 본인 지구 차량 제외
  const { data: trips } = await supabase
    .from("trips")
    .select(
      `
      id, direction, departure_at, price_per_seat,
      origin:region_locations!origin_location_id(label, address),
      destination:region_locations!destination_location_id(label, address),
      region:regions!operator_region_id(name),
      seat_offers(seat_count, status),
      matches(id, status)
    `,
    )
    .eq("status", "published")
    .neq("operator_region_id", session.regionId)
    .order("departure_at", { ascending: true });

  const options = (trips ?? []).map((t) => {
    const origin = one(t.origin);
    const dest = one(t.destination);
    const openSeats = (t.seat_offers ?? [])
      .filter((o) => o.status === "open")
      .reduce((sum, o) => sum + o.seat_count, 0);
    const activeMatches = (t.matches ?? []).filter((m) =>
      (ACTIVE_MATCH_STATUSES as readonly string[]).includes(m.status ?? ""),
    ).length;
    return {
      id: t.id,
      label: `[${DIRECTION_SHORT[t.direction as "up" | "down"]}] ${
        origin?.label ?? origin?.address ?? "출발지"
      } → ${dest?.label ?? dest?.address ?? "도착지"}`,
      regionName: one(t.region)?.name ?? "타지구",
      departure: formatKST(t.departure_at),
      price: t.price_per_seat,
      availableSeats: Math.max(0, openSeats - activeMatches),
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/operator/requests"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← 신청 목록
      </Link>
      <h1 className="mb-6 text-xl font-semibold">타지구 차량 신청</h1>

      {options.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
          현재 신청 가능한 타지구 공개 차량이 없습니다.
        </div>
      ) : (
        <NewRequestForm trips={options} />
      )}
    </div>
  );
}
