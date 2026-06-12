"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchBox } from "@/components/ui/search-box";
import { DIRECTION_SHORT, REQUEST_STATUS_LABEL } from "@/lib/labels";
import { formatDateOnly, formatKstDateTime } from "@/lib/datetime";
import { RequestGraph } from "./RequestGraph";

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
  /** 'student' = 학생 본인 직접 신청, 'operator' = 간사가 대신 신청. */
  requesterKind: "student" | "operator";
  /** true = 버스 미배정 대기큐 신청(trip 없음) — regionName은 대기 대상(공급) 지구명. */
  isWait: boolean;
  /** 대기큐 희망 출발일 "YYYY-MM-DD" (미지정이면 null). */
  waitDesiredDate: string | null;
};

function statusLabel(status: string): string {
  return REQUEST_STATUS_LABEL[status] ?? status;
}

type DirectionFilter = "all" | "up" | "down";
type ViewMode = "list" | "graph";

const DIRECTION_FILTERS: { value: DirectionFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "up", label: DIRECTION_SHORT.up },
  { value: "down", label: DIRECTION_SHORT.down },
];

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "list", label: "목록" },
  { value: "graph", label: "그래프" },
];

// 모바일 친화 세그먼트 컨트롤 — 방향 필터·뷰 토글 공용.
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
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
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
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

export function RequestsList({ requests }: { requests: RequestRow[] }) {
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [view, setView] = useState<ViewMode>("list");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return requests.filter((r) => {
      // 방향 필터 (AND) — 검색어와 결합
      if (direction !== "all" && r.direction !== direction) return false;
      if (!keyword) return true;
      // 필터 대상: 학생 이름 / 도착지·차량 정보 / 상태(텍스트)
      const haystack = [
        ...r.passengerNames,
        r.originLabel,
        r.destLabel,
        r.regionName ?? "",
        DIRECTION_SHORT[r.direction],
        statusLabel(r.status),
        r.isWait ? "대기큐 버스 미배정" : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [requests, q, direction]);

  const emptyMessage =
    requests.length === 0
      ? "아직 신청한 차량이 없습니다."
      : "검색 결과가 없습니다.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="학생 이름·도착지·차량·상태 검색"
        />
        <Segmented
          options={DIRECTION_FILTERS}
          value={direction}
          onChange={setDirection}
          ariaLabel="방향 필터"
        />
        <div className="ml-auto">
          <Segmented
            options={VIEW_MODES}
            value={view}
            onChange={setView}
            ariaLabel="보기 방식"
          />
        </div>
      </div>

      {view === "graph" ? (
        <RequestGraph requests={filtered} emptyMessage={emptyMessage} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
          {emptyMessage}
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
                      {/* 버스 미배정 대기큐 신청 — trip 신청과 구분 (대기큐·Step3 안내와 동일 amber 톤). */}
                      {r.isWait && (
                        <span className="inline-block whitespace-nowrap rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          버스 미배정
                        </span>
                      )}
                      {/* 학생 본인이 직접 신청한 건 — 간사 대신신청과 구분 (공급측 큐와 동일 톤). */}
                      {r.requesterKind === "student" && (
                        <span className="inline-block whitespace-nowrap rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                          학생 직접 신청
                        </span>
                      )}
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
                    {r.isWait ? (
                      // 대기큐 신청 — 차량 대신 대기 대상 지구 + 희망일 표기.
                      <span className="truncate" title={`${r.regionName ?? "타지구"} 대기큐`}>
                        {r.regionName ?? "타지구"} 대기큐 · 희망일{" "}
                        {r.waitDesiredDate ? formatDateOnly(r.waitDesiredDate) : "미지정"}
                      </span>
                    ) : (
                      r.regionName && (
                        <span className="truncate" title={`${r.regionName} 차량`}>
                          {r.regionName} 차량
                        </span>
                      )
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
