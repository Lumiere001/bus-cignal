import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSettlement } from "@/lib/settlement";
import type { SettlementMatch, LedgerEntry } from "@/lib/settlement";
import { one } from "@/lib/supabase/relation";
import { SettlementCsvButton } from "./SettlementCsvButton";

function won(n: number): string {
  return `${n.toLocaleString()}원`;
}

function LedgerTable({
  title,
  emptyText,
  entries,
  confirmedTotal,
  pendingTotal,
}: {
  title: string;
  emptyText: string;
  entries: LedgerEntry[];
  confirmedTotal: number;
  pendingTotal: number;
}) {
  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-2 pr-2 font-medium">지구</th>
                <th className="py-2 px-2 text-right font-medium">확정 (입금완료)</th>
                <th className="py-2 pl-2 text-right font-medium">진행중</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.counterpartRegionId} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium text-gray-800">
                    {e.counterpartRegionName}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className="font-medium text-gray-900">
                      {won(e.confirmedAmount)}
                    </span>
                    <span className="ml-1 text-xs text-gray-400">
                      ({e.confirmedCount}명)
                    </span>
                  </td>
                  <td className="py-2 pl-2 text-right text-gray-500">
                    {e.pendingAmount > 0 ? (
                      <>
                        {won(e.pendingAmount)}
                        <span className="ml-1 text-xs text-gray-400">
                          ({e.pendingCount}명)
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 text-sm font-semibold">
                <td className="py-2 pr-2">합계</td>
                <td className="py-2 px-2 text-right text-gray-900">{won(confirmedTotal)}</td>
                <td className="py-2 pl-2 text-right text-gray-500">{won(pendingTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function Page() {
  const session = await requireOperator();

  if (!session.regionId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          소속 지구 정보가 없어 정산을 볼 수 없습니다. 관리자에게 문의해주세요.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  // 정산 대상 매칭 — trip(공급 지구·요금) + 신청 지구 조인.
  // buildSettlement이 본인 지구 기준으로 받을/보낼만 추려내므로 출력은 본인 지구로 한정됨.
  // (출시 전 RLS로 DB 레벨 스코핑 필요 — PRE-LAUNCH-CHECKLIST 참고)
  // 본인 지구가 공급(받을) 또는 신청(보낼) 측인 매칭만 — DB 스코핑(전국 over-fetch 방지).
  const [{ data: myTrips }, { data: myReqs }] = await Promise.all([
    supabase
      .from("trips")
      .select("id")
      .eq("operator_region_id", session.regionId),
    supabase
      .from("seat_requests")
      .select("id")
      .eq("region_id", session.regionId),
  ]);
  const tripIds = (myTrips ?? []).map((t) => t.id);
  const reqIds = (myReqs ?? []).map((r) => r.id);

  const orParts: string[] = [];
  if (tripIds.length) orParts.push(`trip_id.in.(${tripIds.join(",")})`);
  if (reqIds.length) orParts.push(`request_id.in.(${reqIds.join(",")})`);

  const rows = orParts.length
    ? (
        await supabase
          .from("matches")
          .select(
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
          )
          .or(orParts.join(","))
      ).data
    : null;

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

  const ledger = buildSettlement(session.regionId, matches);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">정산</h1>
          <p className="mt-1 text-xs text-gray-400">
            본인 지구 관련 매칭만 · 사후 처리는 지구 간 자율 (시스템은 표만 제공)
          </p>
        </div>
        <SettlementCsvButton ledger={ledger} />
      </div>

      <div className="space-y-4">
        <LedgerTable
          title="받을 돈 (우리 차량을 탄 지구)"
          emptyText="받을 정산 내역이 없습니다."
          entries={ledger.receivable}
          confirmedTotal={ledger.totals.receivableConfirmed}
          pendingTotal={ledger.totals.receivablePending}
        />
        <LedgerTable
          title="보낼 돈 (우리가 신청해 탄 차량)"
          emptyText="보낼 정산 내역이 없습니다."
          entries={ledger.payable}
          confirmedTotal={ledger.totals.payableConfirmed}
          pendingTotal={ledger.totals.payablePending}
        />
      </div>
    </div>
  );
}
