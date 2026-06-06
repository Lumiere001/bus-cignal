"use client";

import { useMemo, useState } from "react";
import { SearchBox } from "@/components/ui/search-box";
import { DIRECTION_SHORT } from "@/lib/labels";

// 서버(page.tsx)에서 집계해 내려주는 지구별 요약 — 전부 숫자/지구명, PII 없음.
export type RegionSupply = {
  regionId: string;
  regionName: string;
  tripCount: number;
  totalCapacity: number;
  available: number;
  upTrips: number;
  upAvailable: number;
  downTrips: number;
  downAvailable: number;
  waitingTeams: number;
  waitingPeople: number;
};

export function StatusView({ regions }: { regions: RegionSupply[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return regions;
    return regions.filter((r) => r.regionName.toLowerCase().includes(keyword));
  }, [regions, q]);

  const emptyMessage =
    regions.length === 0
      ? "아직 공개된 차량이나 신청이 없습니다."
      : "검색 결과가 없습니다.";

  return (
    <div className="space-y-4">
      <SearchBox value={q} onChange={setQ} placeholder="지구명 검색" />

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const soldOut = r.tripCount > 0 && r.available === 0;
            return (
              <li
                key={r.regionId}
                className="bg-card rounded-xl border p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold">
                      {r.regionName}
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      공개 차량 {r.tripCount}대 · 총 정원 {r.totalCapacity}석
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-2xl font-bold tabular-nums ${
                        soldOut ? "text-muted-foreground" : "text-primary"
                      }`}
                    >
                      {r.available}
                      <span className="ml-0.5 text-sm font-medium">석</span>
                    </p>
                    <p className="text-muted-foreground text-xs">잔여석</p>
                  </div>
                </div>

                {/* 방향별 요약 — 상/하행 차량 수·잔여석 */}
                {(r.upTrips > 0 || r.downTrips > 0) && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-blue-50 px-3 py-2">
                      <p className="text-xs font-semibold text-blue-700">
                        {DIRECTION_SHORT.up}
                      </p>
                      <p className="mt-0.5 text-sm text-blue-900 tabular-nums">
                        차량 {r.upTrips}대 · 잔여 {r.upAvailable}석
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-700">
                        {DIRECTION_SHORT.down}
                      </p>
                      <p className="mt-0.5 text-sm text-emerald-900 tabular-nums">
                        차량 {r.downTrips}대 · 잔여 {r.downAvailable}석
                      </p>
                    </div>
                  </div>
                )}

                {/* 대기 신청 — 건수/인원만 (PII 없음). 공급 지구(=이 지구 버스) 기준. */}
                {r.waitingTeams > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        대기 신청 {r.waitingTeams}건 · {r.waitingPeople}명
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      이 지구 버스를 기다리는(승인 대기) 신청입니다. 신청 지구가
                      아니라 차량 공급 지구 기준이라 위 잔여석과 같은 기준입니다.
                    </p>
                  </div>
                )}

                {soldOut && r.waitingTeams === 0 && (
                  <p className="text-muted-foreground mt-3 text-xs">
                    현재 잔여석이 없습니다.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
