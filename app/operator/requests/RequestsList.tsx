"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchBox } from "@/components/ui/search-box";
import { DIRECTION_SHORT, REQUEST_STATUS_LABEL } from "@/lib/labels";
import { formatKstDateTime } from "@/lib/datetime";

const REQUEST_STATUS_COLOR: Record<string, string> = {
  queued: "bg-blue-100 text-blue-700",
  matched: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

export type RequestRow = {
  id: string;
  status: string;
  direction: "up" | "down";
  requestedAt: string;
  originLabel: string;
  destLabel: string;
  regionName: string | null;
  passengerNames: string[];
};

function statusLabel(status: string): string {
  return REQUEST_STATUS_LABEL[status] ?? status;
}

export function RequestsList({ requests }: { requests: RequestRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return requests;
    return requests.filter((r) => {
      // 필터 대상: 학생 이름 / 도착지·차량 정보 / 상태(텍스트)
      const haystack = [
        ...r.passengerNames,
        r.originLabel,
        r.destLabel,
        r.regionName ?? "",
        DIRECTION_SHORT[r.direction],
        statusLabel(r.status),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [requests, q]);

  return (
    <div className="space-y-4">
      <SearchBox
        value={q}
        onChange={setQ}
        placeholder="학생 이름·도착지·차량·상태 검색"
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
          {requests.length === 0
            ? "아직 신청한 차량이 없습니다."
            : "검색 결과가 없습니다."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const status = r.status;
            const paxCount = r.passengerNames.length;
            const paxPreview =
              r.passengerNames.slice(0, 3).join(", ") +
              (paxCount > 3 ? ` 외 ${paxCount - 3}명` : "");

            return (
              <li key={r.id}>
                <Link
                  href={`/operator/requests/${r.id}`}
                  className="flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block whitespace-nowrap rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {DIRECTION_SHORT[r.direction]}
                      </span>
                      <span
                        className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${
                          REQUEST_STATUS_COLOR[status] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {statusLabel(status)}
                      </span>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">
                      {formatKstDateTime(r.requestedAt)} 신청
                    </span>
                  </div>

                  <div className="text-sm font-medium text-gray-800">
                    {r.originLabel} → {r.destLabel}
                  </div>

                  {/* 신청한 학생 이름 미리보기 (모바일에선 hover가 없으니 인라인으로 표시) */}
                  {paxCount > 0 && (
                    <div className="text-xs text-gray-600">
                      신청 학생: <span className="text-gray-800">{paxPreview}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {r.regionName && (
                      <span className="truncate" title={`${r.regionName} 차량`}>
                        {r.regionName} 차량
                      </span>
                    )}
                    <span className="whitespace-nowrap">학생 {paxCount}명</span>
                    <span className="ml-auto shrink-0 whitespace-nowrap text-blue-600">
                      상세 보기 →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
