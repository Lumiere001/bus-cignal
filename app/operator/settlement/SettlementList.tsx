"use client";

import { useMemo, useState } from "react";
import { SearchBox } from "@/components/ui/search-box";
import { SettlementCsvButton } from "./SettlementCsvButton";
import type { SettlementLedger, LedgerEntry } from "@/lib/settlement";

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
          <table className="w-full min-w-[380px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="py-2 pr-2 font-medium">지구</th>
                <th className="py-2 px-2 text-right font-medium whitespace-nowrap">확정 (입금완료)</th>
                <th className="py-2 pl-2 text-right font-medium whitespace-nowrap">진행중</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.counterpartRegionId} className="border-b last:border-0">
                  <td className="py-2 pr-2 font-medium text-gray-800">
                    <span
                      className="block max-w-[10rem] truncate"
                      title={e.counterpartRegionName}
                    >
                      {e.counterpartRegionName}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right whitespace-nowrap">
                    <span className="font-medium text-gray-900 tabular-nums">
                      {won(e.confirmedAmount)}
                    </span>
                    <span className="ml-1 text-xs text-gray-400 tabular-nums">
                      ({e.confirmedCount}명)
                    </span>
                  </td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap text-gray-500">
                    {e.pendingAmount > 0 ? (
                      <>
                        <span className="tabular-nums">{won(e.pendingAmount)}</span>
                        <span className="ml-1 text-xs text-gray-400 tabular-nums">
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
                <td className="py-2 px-2 text-right whitespace-nowrap text-gray-900 tabular-nums">{won(confirmedTotal)}</td>
                <td className="py-2 pl-2 text-right whitespace-nowrap text-gray-500 tabular-nums">{won(pendingTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export function SettlementList({ ledger }: { ledger: SettlementLedger }) {
  const [q, setQ] = useState("");

  // 검색: 상대 지구명(받을/보낼 상대)만 필터. 정산 계산은 서버에서 끝났고
  // 여기선 표시 행만 좁힌다. 합계는 "보이는 행 기준"으로 다시 합산(필터 일관성).
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ledger;

    const match = (e: LedgerEntry) =>
      e.counterpartRegionName.toLowerCase().includes(term);
    const sum = (entries: LedgerEntry[]) =>
      entries.reduce(
        (acc, e) => {
          acc.confirmed += e.confirmedAmount;
          acc.pending += e.pendingAmount;
          return acc;
        },
        { confirmed: 0, pending: 0 },
      );

    const receivable = ledger.receivable.filter(match);
    const payable = ledger.payable.filter(match);
    const recvSum = sum(receivable);
    const paySum = sum(payable);

    return {
      receivable,
      payable,
      totals: {
        receivableConfirmed: recvSum.confirmed,
        receivablePending: recvSum.pending,
        payableConfirmed: paySum.confirmed,
        payablePending: paySum.pending,
      },
    };
  }, [ledger, q]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SearchBox value={q} onChange={setQ} placeholder="상대 지구명 검색" />
        </div>
        <div className="shrink-0">
          <SettlementCsvButton ledger={ledger} />
        </div>
      </div>

      <div className="space-y-4">
        <LedgerTable
          title="받을 돈 (우리 차량을 탄 지구)"
          emptyText={
            q.trim()
              ? "검색 결과가 없습니다."
              : "받을 정산 내역이 없습니다."
          }
          entries={filtered.receivable}
          confirmedTotal={filtered.totals.receivableConfirmed}
          pendingTotal={filtered.totals.receivablePending}
        />
        <LedgerTable
          title="보낼 돈 (우리가 신청해 탄 차량)"
          emptyText={
            q.trim()
              ? "검색 결과가 없습니다."
              : "보낼 정산 내역이 없습니다."
          }
          entries={filtered.payable}
          confirmedTotal={filtered.totals.payableConfirmed}
          pendingTotal={filtered.totals.payablePending}
        />
      </div>
    </>
  );
}
