"use client";

import { useMemo, useState } from "react";
import { SearchBox } from "@/components/ui/search-box";
import { DIRECTION_SHORT, MATCH_STATUS_LABEL } from "@/lib/labels";

// 공급 간사 "탑승 학생" 뷰 — 서버에서 정규화한 행을 받아 신청 지구별로 묶고,
// 클라이언트에서 텍스트 필터링(학생 이름·지구·노선·상태). matches/MatchesList 분할 패턴 미러.
export type BoarderRow = {
  id: string;
  status: string;
  reservationCode: string | null;
  direction: "up" | "down";
  route: string;
  departure: string;
  studentName: string;
  schoolOrRole: string | null;
  phone: string | null;
  regionId: string;
  regionName: string;
  operatorName: string | null;
  operatorPhone: string | null;
};

type BoarderGroup = {
  regionId: string;
  regionName: string;
  operatorName: string | null;
  operatorPhone: string | null;
  members: BoarderRow[];
};

// 입금확인(paid) chip은 확정 탑승이라 강조색, 그 외 진행 상태는 회색.
function statusChipClass(status: string): string {
  return status === "paid"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-gray-100 text-gray-500";
}

export function BoardingGroups({ boarders }: { boarders: BoarderRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return boarders;
    return boarders.filter((b) => {
      const statusLabel = MATCH_STATUS_LABEL[b.status] ?? b.status;
      const haystack = [
        b.studentName,
        b.regionName,
        b.route,
        b.status,
        statusLabel,
        b.reservationCode ?? "",
        b.schoolOrRole ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [boarders, q]);

  // 신청 지구별 그룹핑 — 지구당 학생 수가 많은 순 → 지구명 순으로 정렬.
  const groups = useMemo(() => {
    const map = new Map<string, BoarderGroup>();
    for (const b of filtered) {
      const g = map.get(b.regionId);
      if (g) {
        g.members.push(b);
      } else {
        map.set(b.regionId, {
          regionId: b.regionId,
          regionName: b.regionName,
          operatorName: b.operatorName,
          operatorPhone: b.operatorPhone,
          members: [b],
        });
      }
    }
    return [...map.values()].sort(
      (a, z) =>
        z.members.length - a.members.length ||
        a.regionName.localeCompare(z.regionName, "ko"),
    );
  }, [filtered]);

  const totalStudents = boarders.length;
  const confirmedStudents = boarders.filter((b) => b.status === "paid").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="학생 · 지구 · 노선 · 상태 검색"
        />
        {totalStudents > 0 && (
          <span className="text-xs text-gray-500">
            총 {totalStudents}명 · 확정 {confirmedStudents}명
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-500">
          {q.trim()
            ? "검색 결과가 없습니다."
            : "아직 우리 차량에 매칭된 타지구 학생이 없습니다."}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section
              key={g.regionId}
              className="rounded-xl border bg-white shadow-sm"
            >
              {/* 그룹 헤더 — 지구명 · 인원 · 담당 간사 연락 (채팅은 지구별 아님 → 차량 방으로) */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-gray-50/60 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  {g.regionName}
                </h2>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {g.members.length}명
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {g.operatorPhone ? (
                    <a
                      href={`tel:${g.operatorPhone}`}
                      aria-label={`담당 간사${g.operatorName ? ` ${g.operatorName}` : ""}에게 전화`}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                    >
                      <span aria-hidden>📞</span> 담당 간사{g.operatorName ? ` ${g.operatorName}` : ""}에게 연락
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500">담당 간사 연락처 없음</span>
                  )}
                </div>
              </div>

              {/* 학생 행 */}
              <ul className="divide-y">
                {g.members.map((b) => (
                  <li key={b.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block whitespace-nowrap rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {DIRECTION_SHORT[b.direction]}
                      </span>
                      <span
                        className="min-w-0 truncate text-sm font-medium text-gray-900"
                        title={b.studentName}
                      >
                        {b.studentName}
                      </span>
                      {b.schoolOrRole && (
                        <span className="truncate text-xs text-gray-500" title={b.schoolOrRole}>
                          {b.schoolOrRole}
                        </span>
                      )}
                      <span
                        className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${statusChipClass(b.status)}`}
                      >
                        {MATCH_STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </div>

                    <div className="mt-1 truncate text-sm text-gray-700" title={b.route}>
                      {b.route}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="whitespace-nowrap">{b.departure} 출발</span>
                      {b.phone ? (
                        <a
                          href={`tel:${b.phone}`}
                          aria-label={`${b.studentName} 전화 ${b.phone}`}
                          className="inline-flex min-h-[32px] items-center whitespace-nowrap rounded tabular-nums text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                        >
                          {b.phone}
                        </a>
                      ) : (
                        <span className="text-gray-500">전화 없음</span>
                      )}
                      {b.reservationCode && (
                        <span className="whitespace-nowrap font-mono text-gray-600">
                          {b.reservationCode}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
