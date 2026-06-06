"use client";

import { useMemo, useState } from "react";
import { SearchBox } from "@/components/ui/search-box";
import { DIRECTION_SHORT, MATCH_STATUS_LABEL } from "@/lib/labels";
import { MatchPaymentCell } from "./MatchPaymentCell";

// 간사 "신청" 목록 — 서버에서 정규화한 행을 받아 클라이언트에서 텍스트 필터링.
// 카드 마크업은 서버 컴포넌트가 렌더하던 형태 그대로 유지(제목+검색만 추가).
export type MatchRow = {
  id: string;
  status: string;
  reservationCode: string | null;
  direction: "up" | "down";
  studentName: string;
  route: string;
  departure: string;
  pricePerSeat: number | null;
  supplyName: string | null;
};

export function MatchesList({ matches }: { matches: MatchRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return matches;
    return matches.filter((m) => {
      const statusLabel = MATCH_STATUS_LABEL[m.status] ?? m.status;
      const haystack = [
        m.studentName,
        m.reservationCode ?? "",
        m.status,
        statusLabel,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [matches, q]);

  return (
    <>
      <div className="mb-4">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="학생 이름 · 예약번호 · 상태 검색"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
          {q.trim() ? "검색 결과가 없습니다." : "매칭된 건이 없습니다."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((m) => (
            <li key={m.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block whitespace-nowrap rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {DIRECTION_SHORT[m.direction]}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-gray-900" title={m.studentName}>
                      {m.studentName}
                    </span>
                    <span className="inline-block whitespace-nowrap rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {MATCH_STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm text-gray-700" title={m.route}>
                    {m.route}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                    <span className="whitespace-nowrap">{m.departure} 출발</span>
                    {m.pricePerSeat !== null && (
                      <span className="whitespace-nowrap tabular-nums">
                        {m.pricePerSeat.toLocaleString()}원/인
                      </span>
                    )}
                    {m.supplyName && (
                      <span className="truncate" title={`${m.supplyName} 차량`}>
                        {m.supplyName} 차량
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <MatchPaymentCell
                    matchId={m.id}
                    status={m.status}
                    reservationCode={m.reservationCode}
                    studentName={m.studentName}
                    route={m.route}
                    departure={m.departure}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
