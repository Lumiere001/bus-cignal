"use client";

import { useMemo, useState } from "react";
import { SearchBox } from "@/components/ui/search-box";
import { DIRECTION_SHORT, TRIP_STATUS_COLOR, TRIP_STATUS_LABEL } from "@/lib/labels";
import { formatKstShort } from "@/lib/datetime";

export type TripRow = {
  id: string;
  direction: "up" | "down";
  departureAt: string;
  capacity: number;
  remaining: number;
  pricePerSeat: number;
  status: "draft" | "published" | "closed";
  regionName: string | null;
  originLabel: string;
  destLabel: string;
};

type DirectionFilter = "all" | "up" | "down";
type StatusFilter = "all" | "draft" | "published" | "closed";

const DIRECTION_FILTERS: { value: DirectionFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "up", label: DIRECTION_SHORT.up },
  { value: "down", label: DIRECTION_SHORT.down },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "published", label: TRIP_STATUS_LABEL.published },
  { value: "draft", label: TRIP_STATUS_LABEL.draft },
  { value: "closed", label: TRIP_STATUS_LABEL.closed },
];

// 모바일 친화 세그먼트 컨트롤 — 방향·상태 필터 칩 공용 (operator RequestsList 패턴).
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

export function TripsSearch({ rows }: { rows: TripRow[] }) {
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return rows.filter((t) => {
      // 칩 필터(AND) — 방향·상태
      if (direction !== "all" && t.direction !== direction) return false;
      if (status !== "all" && t.status !== status) return false;
      if (!keyword) return true;
      // 검색 대상: 지구명 / 출발지·도착지 / 방향 / 상태 / 출발일(MM/DD HH:MM)
      const haystack = [
        t.regionName ?? "",
        t.originLabel,
        t.destLabel,
        DIRECTION_SHORT[t.direction],
        TRIP_STATUS_LABEL[t.status],
        formatKstShort(t.departureAt),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [rows, q, direction, status]);

  const emptyMessage =
    rows.length === 0 ? "등록된 차량이 없습니다." : "검색 결과가 없습니다.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="지구·출발지·도착지·방향·상태·출발일 검색"
        />
        <Segmented
          options={DIRECTION_FILTERS}
          value={direction}
          onChange={setDirection}
          ariaLabel="방향 필터"
        />
        <Segmented
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
          ariaLabel="상태 필터"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">공급 지구</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">노선</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">방향</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">출발</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">정원</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">잔여</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">요금</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    {t.regionName ?? "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {t.originLabel} → {t.destLabel}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{DIRECTION_SHORT[t.direction]}</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">
                    {formatKstShort(t.departureAt)}
                  </td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{t.capacity}석</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">{t.remaining}석</td>
                  <td className="px-4 py-2 tabular-nums whitespace-nowrap">
                    {t.pricePerSeat.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TRIP_STATUS_COLOR[t.status]}`}
                    >
                      {TRIP_STATUS_LABEL[t.status]}
                    </span>
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
