"use client";

import { useState } from "react";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import { formatKstShort } from "@/lib/datetime";
import { MatchesGraph, type MatchesGraphData } from "./MatchesGraph";

// 마스터 전국 매칭 — 목록/그래프 뷰 토글 래퍼.
// 목록: 기존 테이블(공급/신청 지구·금액·상태·시각, 학생 개인정보 비노출) 그대로.
// 그래프: 옵시디언풍 지구 노드 다이어그램(MatchesGraph).

export type MatchRow = {
  id: string;
  status: string;
  matchedAt: string;
  pricePerSeat: number | null;
  supplyName: string;
  requestName: string;
};

type ViewMode = "list" | "graph";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "list", label: "목록" },
  { value: "graph", label: "그래프" },
];

// 모바일 친화 세그먼트 컨트롤 (RequestsList와 동일 패턴).
function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: ViewMode; label: string }[];
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border bg-gray-50 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function MatchesView({
  rows,
  graph,
}: {
  rows: MatchRow[];
  graph: MatchesGraphData;
}) {
  const [view, setView] = useState<ViewMode>("list");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Segmented
          options={VIEW_MODES}
          value={view}
          onChange={setView}
          ariaLabel="보기 방식"
        />
      </div>

      {view === "graph" ? (
        <MatchesGraph data={graph} emptyMessage="매칭 내역이 없습니다." />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">매칭 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">공급 지구</th>
                <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">신청 지구</th>
                <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">금액</th>
                <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">상태</th>
                <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">매칭 시각</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{m.supplyName}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{m.requestName}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">
                    {m.pricePerSeat !== null
                      ? `${m.pricePerSeat.toLocaleString("ko-KR")}원`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {MATCH_STATUS_LABEL[m.status] ?? m.status}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                    {formatKstShort(m.matchedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
