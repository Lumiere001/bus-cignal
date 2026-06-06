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
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
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
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {DIRECTION_SHORT[m.direction]}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{m.studentName}</span>
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {MATCH_STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">{m.route}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                    <span>{m.departure} 출발</span>
                    {m.pricePerSeat !== null && (
                      <span>{m.pricePerSeat.toLocaleString()}원/인</span>
                    )}
                    {m.supplyName && <span>{m.supplyName} 차량</span>}
                  </div>
                  {/* 송금 정보 (공급 지구 계좌) — awaiting_payment일 때 안내 */}
                  {m.status === "awaiting_payment" && m.bankAccount && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      송금 계좌: {m.bankName} {m.bankAccount}
                      {m.accountHolder ? ` (${m.accountHolder})` : ""}
                    </div>
                  )}
                </div>

                <MatchPaymentCell
                  matchId={m.id}
                  status={m.status}
                  reservationCode={m.reservationCode}
                  studentName={m.studentName}
                  route={m.route}
                  departure={m.departure}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
