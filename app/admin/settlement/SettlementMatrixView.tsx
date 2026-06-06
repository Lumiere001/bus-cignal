"use client";

import { useMemo, useState } from "react";
import { SearchBox } from "@/components/ui/search-box";
import type { MatrixCell, MatrixRegion, SettlementMatrix } from "@/lib/settlement";

// 전국 정산 매트릭스 표 + 지구 검색/필터 + 셀 클릭 상세(ledger) + CSV.
// 데이터 집계는 서버(lib/settlement, core/locked). 이 컴포넌트는 표현·필터만.

function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function man(n: number): string {
  return n.toLocaleString("ko-KR");
}

function cellKey(supplyId: string, requestId: string): string {
  return `${supplyId} ${requestId}`;
}

export function SettlementMatrixView({ matrix }: { matrix: SettlementMatrix }) {
  const [selected, setSelected] = useState<MatrixCell | null>(null);
  const [hovered, setHovered] = useState<{ supplyId: string; requestId: string } | null>(null);
  const [query, setQuery] = useState("");

  const { regions } = matrix;

  const nameOf = useMemo(() => {
    const m = new Map(regions.map((r) => [r.id, r.name]));
    return (id: string) => m.get(id) ?? "?";
  }, [regions]);

  const cellAt = useMemo(() => {
    const m = new Map(matrix.cells.map((c) => [cellKey(c.supplyRegionId, c.requestRegionId), c]));
    return (supplyId: string, requestId: string) => m.get(cellKey(supplyId, requestId)) ?? null;
  }, [matrix.cells]);

  // 검색: 지구명에 query가 포함되면 "포커스 지구". 매트릭스가 커도 특정 지구를 빠르게 찾기 위함.
  // 포커스 지구와 거래(셀)가 있는 상대 지구까지 행/열에 함께 노출해 그 지구의 정산 관계를 한눈에.
  const q = query.trim().toLowerCase();
  const isFiltering = q.length > 0;

  const focusIds = useMemo(() => {
    if (!isFiltering) return new Set<string>();
    return new Set(regions.filter((r) => r.name.toLowerCase().includes(q)).map((r) => r.id));
  }, [regions, q, isFiltering]);

  // 표시할 행(공급)·열(신청): 필터 시 포커스 지구 + 포커스와 거래가 있는 상대 지구만.
  const { visibleRows, visibleCols } = useMemo(() => {
    if (!isFiltering) {
      return { visibleRows: regions, visibleCols: regions };
    }
    const rowIds = new Set<string>();
    const colIds = new Set<string>();
    for (const c of matrix.cells) {
      const supplyFocus = focusIds.has(c.supplyRegionId);
      const requestFocus = focusIds.has(c.requestRegionId);
      if (supplyFocus || requestFocus) {
        rowIds.add(c.supplyRegionId);
        colIds.add(c.requestRegionId);
      }
    }
    // 포커스 지구는 거래가 없어도 축에 노출(빈 행/열이라도 "찾았다"는 신호).
    for (const id of focusIds) {
      rowIds.add(id);
      colIds.add(id);
    }
    const keepRow = (r: MatrixRegion) => rowIds.has(r.id);
    const keepCol = (r: MatrixRegion) => colIds.has(r.id);
    return {
      visibleRows: regions.filter(keepRow),
      visibleCols: regions.filter(keepCol),
    };
  }, [regions, matrix.cells, focusIds, isFiltering]);

  // 행 합(공급별 받을)·열 합(신청별 보낼) — 확정 기준.
  // 필터 중에는 "보이는 칸"만 합산해 표 안의 행/열 합과 일치시킨다(아래 표시 합과 동일 정의).
  const visibleColIdSet = useMemo(() => new Set(visibleCols.map((r) => r.id)), [visibleCols]);
  const visibleRowIdSet = useMemo(() => new Set(visibleRows.map((r) => r.id)), [visibleRows]);

  const { rowTotal, colTotal, visibleConfirmed, visiblePending } = useMemo(() => {
    const rt = new Map<string, number>();
    const ct = new Map<string, number>();
    let vc = 0;
    let vp = 0;
    for (const c of matrix.cells) {
      const inView = visibleRowIdSet.has(c.supplyRegionId) && visibleColIdSet.has(c.requestRegionId);
      if (!inView) continue;
      rt.set(c.supplyRegionId, (rt.get(c.supplyRegionId) ?? 0) + c.confirmedAmount);
      ct.set(c.requestRegionId, (ct.get(c.requestRegionId) ?? 0) + c.confirmedAmount);
      vc += c.confirmedAmount;
      vp += c.pendingAmount;
    }
    return { rowTotal: rt, colTotal: ct, visibleConfirmed: vc, visiblePending: vp };
  }, [matrix.cells, visibleRowIdSet, visibleColIdSet]);

  function downloadCsv() {
    const header = ["공급지구", "신청지구", "확정건수", "확정금액", "진행건수", "진행금액"];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    // CSV는 항상 전국 전체(필터 무관) — 마스터의 회계 산출물이므로 누락 방지.
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

  const noMatch = isFiltering && visibleRows.length === 0 && visibleCols.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 sm:flex-none">
          <SearchBox value={query} onChange={setQuery} placeholder="지구명 검색 (행·열 필터)" />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            {isFiltering ? (
              <>
                <span className="text-muted-foreground">필터 확정 합계 </span>
                <span className="font-bold tabular-nums whitespace-nowrap">{won(visibleConfirmed)}</span>
                {visiblePending > 0 && (
                  <span className="text-muted-foreground ml-2 whitespace-nowrap">
                    (진행중 {won(visiblePending)})
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-muted-foreground">전국 확정 합계 </span>
                <span className="font-bold tabular-nums whitespace-nowrap">
                  {won(matrix.grandConfirmedAmount)}
                </span>
                {matrix.grandPendingAmount > 0 && (
                  <span className="text-muted-foreground ml-2 whitespace-nowrap">
                    (진행중 {won(matrix.grandPendingAmount)})
                  </span>
                )}
              </>
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
      </div>

      {isFiltering && !noMatch && (
        <p className="text-muted-foreground text-xs">
          &lsquo;{query.trim()}&rsquo; 관련 지구 {focusIds.size}곳 ·{" "}
          {visibleRows.length}행 × {visibleCols.length}열 표시 중. 합계는{" "}
          <span className="font-medium">표시된 칸 기준</span>입니다.{" "}
          <button
            type="button"
            onClick={() => setQuery("")}
            className="hover:text-foreground underline underline-offset-2"
          >
            필터 해제
          </button>
        </p>
      )}

      {noMatch ? (
        <p className="text-muted-foreground rounded-xl border p-8 text-center text-sm">
          &lsquo;{query.trim()}&rsquo;와 일치하는 지구가 없습니다.{" "}
          <button
            type="button"
            onClick={() => setQuery("")}
            className="hover:text-foreground underline underline-offset-2"
          >
            필터 해제
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-muted-foreground bg-muted sticky left-0 top-0 z-20 px-3 py-2 text-left text-xs font-medium whitespace-nowrap">
                  공급↓ / 신청→
                </th>
                {visibleCols.map((r) => {
                  const isFocus = focusIds.has(r.id);
                  const isHoverCol = hovered?.requestId === r.id;
                  return (
                    <th
                      key={r.id}
                      className={`px-3 py-2 text-right text-xs font-medium whitespace-nowrap transition-colors ${
                        isFocus ? "text-primary font-semibold" : ""
                      } ${isHoverCol ? "bg-primary/10" : ""}`}
                    >
                      {r.name}
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">받을 합</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((supply, rowIdx) => {
                const isFocusRow = focusIds.has(supply.id);
                const isHoverRow = hovered?.supplyId === supply.id;
                const zebra = rowIdx % 2 === 1 ? "bg-muted/20" : "";
                return (
                  <tr
                    key={supply.id}
                    className={`border-t transition-colors ${zebra} ${
                      isHoverRow ? "bg-primary/[0.04]" : ""
                    }`}
                  >
                    <th
                      className={`sticky left-0 z-10 px-3 py-2 text-left font-medium whitespace-nowrap ${
                        isHoverRow ? "bg-primary/5" : "bg-background"
                      } ${isFocusRow ? "text-primary font-semibold" : ""}`}
                    >
                      {supply.name}
                    </th>
                    {visibleCols.map((request) => {
                      const c = cellAt(supply.id, request.id);
                      const isHoverCol = hovered?.requestId === request.id;
                      const crossHi = (isHoverRow || isHoverCol) && !(isHoverRow && isHoverCol);
                      if (!c) {
                        // 빈칸(거래 없음): 점선 점. 0원(거래는 있으나 확정 0)과 구분.
                        return (
                          <td
                            key={request.id}
                            onMouseEnter={() =>
                              setHovered({ supplyId: supply.id, requestId: request.id })
                            }
                            onMouseLeave={() => setHovered(null)}
                            className={`text-muted-foreground/30 px-3 py-2 text-center transition-colors ${
                              crossHi ? "bg-primary/[0.04]" : ""
                            }`}
                            title="거래 없음"
                          >
                            ·
                          </td>
                        );
                      }
                      const isSel =
                        selected?.supplyRegionId === c.supplyRegionId &&
                        selected?.requestRegionId === c.requestRegionId;
                      const zeroConfirmed = c.confirmedAmount === 0;
                      return (
                        <td
                          key={request.id}
                          onMouseEnter={() =>
                            setHovered({ supplyId: supply.id, requestId: request.id })
                          }
                          onMouseLeave={() => setHovered(null)}
                          className={`px-1 py-1 text-right transition-colors ${
                            crossHi ? "bg-primary/[0.06]" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelected(c)}
                            className={`hover:bg-primary/10 w-full rounded px-2 py-1 text-right tabular-nums transition-colors ${
                              isSel ? "bg-primary/15 ring-primary/40 ring-1" : ""
                            }`}
                            title={`${supply.name} → ${request.name}`}
                          >
                            <span
                              className={`block whitespace-nowrap ${
                                zeroConfirmed
                                  ? "text-muted-foreground/60 font-normal"
                                  : "font-medium"
                              }`}
                            >
                              {man(c.confirmedAmount)}
                            </span>
                            {c.pendingAmount > 0 && (
                              <span className="block text-xs whitespace-nowrap text-blue-600 dark:text-blue-400">
                                +{man(c.pendingAmount)}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="bg-muted/30 px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                      {man(rowTotal.get(supply.id) ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <th className="bg-background sticky left-0 z-10 px-3 py-2 text-left font-semibold whitespace-nowrap">
                  보낼 합
                </th>
                {visibleCols.map((request) => (
                  <td
                    key={request.id}
                    className="bg-muted/30 px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap"
                  >
                    {man(colTotal.get(request.id) ?? 0)}
                  </td>
                ))}
                <td className="bg-muted/50 px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap">
                  {man(visibleConfirmed)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        금액 단위: 원 · 큰 숫자 = 확정(입금완료) · <span className="text-blue-600 dark:text-blue-400">+파란 숫자</span> = 진행중 · <span className="text-muted-foreground/50">·</span> = 거래 없음 · 0 = 거래 있으나 확정 없음
      </p>

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
