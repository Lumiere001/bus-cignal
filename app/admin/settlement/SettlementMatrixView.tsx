"use client";

import { useMemo, useState } from "react";
import type { MatrixCell, SettlementMatrix } from "@/lib/settlement";

// 전국 정산 매트릭스 표 + 셀 클릭 상세(ledger) + CSV. 데이터 집계는 서버(lib/settlement).

function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function cellKey(supplyId: string, requestId: string): string {
  return `${supplyId} ${requestId}`;
}

export function SettlementMatrixView({ matrix }: { matrix: SettlementMatrix }) {
  const [selected, setSelected] = useState<MatrixCell | null>(null);

  const { regions } = matrix;
  const nameOf = useMemo(() => {
    const m = new Map(regions.map((r) => [r.id, r.name]));
    return (id: string) => m.get(id) ?? "?";
  }, [regions]);

  const cellAt = useMemo(() => {
    const m = new Map(matrix.cells.map((c) => [cellKey(c.supplyRegionId, c.requestRegionId), c]));
    return (supplyId: string, requestId: string) => m.get(cellKey(supplyId, requestId)) ?? null;
  }, [matrix.cells]);

  // 행 합(공급별 받을), 열 합(신청별 보낼) — 확정 기준.
  const rowTotal = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of matrix.cells) {
      m.set(c.supplyRegionId, (m.get(c.supplyRegionId) ?? 0) + c.confirmedAmount);
    }
    return m;
  }, [matrix.cells]);
  const colTotal = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of matrix.cells) {
      m.set(c.requestRegionId, (m.get(c.requestRegionId) ?? 0) + c.confirmedAmount);
    }
    return m;
  }, [matrix.cells]);

  function downloadCsv() {
    const header = ["공급지구", "신청지구", "확정건수", "확정금액", "진행건수", "진행금액"];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const body = matrix.cells.map((c) => [
      nameOf(c.supplyRegionId),
      nameOf(c.requestRegionId),
      String(c.confirmedCount),
      String(c.confirmedAmount),
      String(c.pendingCount),
      String(c.pendingAmount),
    ]);
    const csv = [header, ...body].map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }); // BOM=엑셀 한글
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "settlement-matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (regions.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border p-8 text-center text-sm">
        정산 대상 매칭이 아직 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="text-muted-foreground">전국 확정 합계 </span>
          <span className="font-bold tabular-nums whitespace-nowrap">{won(matrix.grandConfirmedAmount)}</span>
          {matrix.grandPendingAmount > 0 && (
            <span className="text-muted-foreground ml-2 whitespace-nowrap">
              (진행중 {won(matrix.grandPendingAmount)})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="hover:bg-muted shrink-0 rounded-md border px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors"
        >
          CSV 내보내기
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-muted-foreground sticky left-0 z-10 bg-inherit px-3 py-2 text-left text-xs font-medium whitespace-nowrap">
                공급↓ / 신청→
              </th>
              {regions.map((r) => (
                <th key={r.id} className="px-3 py-2 text-right text-xs font-medium whitespace-nowrap">
                  {r.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">받을 합</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((supply) => (
              <tr key={supply.id} className="border-t">
                <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium whitespace-nowrap">
                  {supply.name}
                </th>
                {regions.map((request) => {
                  const c = cellAt(supply.id, request.id);
                  if (!c) {
                    return (
                      <td key={request.id} className="text-muted-foreground/40 px-3 py-2 text-right">
                        ·
                      </td>
                    );
                  }
                  const isSel =
                    selected?.supplyRegionId === c.supplyRegionId &&
                    selected?.requestRegionId === c.requestRegionId;
                  return (
                    <td key={request.id} className="px-1 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(c)}
                        className={`hover:bg-primary/10 w-full rounded px-2 py-1 text-right tabular-nums transition-colors ${
                          isSel ? "bg-primary/15 ring-primary/40 ring-1" : ""
                        }`}
                      >
                        <span className="block font-medium whitespace-nowrap">{c.confirmedAmount.toLocaleString("ko-KR")}</span>
                        {c.pendingAmount > 0 && (
                          <span className="text-muted-foreground block text-xs whitespace-nowrap">
                            +{c.pendingAmount.toLocaleString("ko-KR")}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                  {(rowTotal.get(supply.id) ?? 0).toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-semibold whitespace-nowrap">
                보낼 합
              </th>
              {regions.map((request) => (
                <td key={request.id} className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                  {(colTotal.get(request.id) ?? 0).toLocaleString("ko-KR")}
                </td>
              ))}
              <td className="bg-muted/30 px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap">
                {matrix.grandConfirmedAmount.toLocaleString("ko-KR")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">금액 단위: 원 · 큰 숫자 = 확정, +파란 작은 숫자 = 진행중</p>

      {selected && (
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 truncate text-sm font-semibold">
              {nameOf(selected.supplyRegionId)} → {nameOf(selected.requestRegionId)}
            </h2>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
            >
              닫기
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <dt className="text-muted-foreground text-xs">확정 (입금완료)</dt>
              <dd className="mt-0.5 font-bold tabular-nums whitespace-nowrap">{won(selected.confirmedAmount)}</dd>
              <dd className="text-muted-foreground text-xs">{selected.confirmedCount}명</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-muted-foreground text-xs">진행중 (송금 대기·보고)</dt>
              <dd className="mt-0.5 font-bold tabular-nums whitespace-nowrap">{won(selected.pendingAmount)}</dd>
              <dd className="text-muted-foreground text-xs">{selected.pendingCount}명</dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-3 text-xs">
            {nameOf(selected.requestRegionId)} 간사가 {nameOf(selected.supplyRegionId)} 간사에게 보낼 금액입니다.
          </p>
        </div>
      )}
    </div>
  );
}
