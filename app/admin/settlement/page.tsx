import { createAdminClient } from "@/lib/supabase/admin";
import { buildSettlementMatrix } from "@/lib/settlement";
import type { SettlementMatch } from "@/lib/settlement";
import { SettlementMatrixView } from "./SettlementMatrixView";

export const dynamic = "force-dynamic";

// SPEC §S7·§5.9 — 마스터 전국 정산 매트릭스(공급×신청 N×N) + 셀 클릭 ledger + CSV.
// operator 정산과 동일한 매칭 쿼리·집계 규칙(lib/settlement)을 쓰되 지구 필터 없이 전국.
// 접근 보호 = middleware(/admin/*). 사후 정산은 지구 간 자율(시스템은 표만, N5).

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

async function loadMatrix() {
  const db = createAdminClient();
  const { data: rows } = await db.from("matches").select(
    `
      id, status,
      trip:trips!trip_id(
        price_per_seat, operator_region_id,
        supply:regions!operator_region_id(name)
      ),
      request:seat_requests!request_id(
        region_id,
        region:regions!region_id(name)
      )
    `,
  );

  const matches: SettlementMatch[] = (rows ?? [])
    .map((r): SettlementMatch | null => {
      const trip = one(r.trip);
      const request = one(r.request);
      if (!trip || !request) return null;
      return {
        matchId: r.id,
        status: r.status as SettlementMatch["status"],
        pricePerSeat: trip.price_per_seat,
        supplyRegionId: trip.operator_region_id,
        supplyRegionName: one(trip.supply)?.name ?? "?",
        requestRegionId: request.region_id,
        requestRegionName: one(request.region)?.name ?? "?",
      };
    })
    .filter((m): m is SettlementMatch => m !== null);

  return buildSettlementMatrix(matches);
}

export default async function AdminSettlementPage() {
  const matrix = await loadMatrix();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전국 정산 매트릭스</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          공급 지구(행) → 신청 지구(열) · 칸 = 공급이 받을 금액 · 셀 클릭 시 상세
        </p>
      </div>
      <SettlementMatrixView matrix={matrix} />
      <p className="text-muted-foreground text-xs">
        확정 = 입금 완료(paid) · 진행중 = 송금 대기/보고(awaiting·reported). 매칭 해제·취소는 제외.
        사후 정산(환불·노쇼)은 지구 간 자율 — 시스템은 집계 표만 제공합니다.
      </p>
    </main>
  );
}
