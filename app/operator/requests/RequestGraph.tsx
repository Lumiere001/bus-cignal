"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { DIRECTION_SHORT, REQUEST_STATUS_LABEL } from "@/lib/labels";
import type { RequestRow } from "./RequestsList";

// 옵시디언 그래프뷰 — 외부 라이브러리 없이 인라인 SVG로 그린 노드 다이어그램.
// 중앙 "우리 지구" 노드 + 신청 1건당 노드(방사형 배치) + 중앙→노드 엣지.
// 노드 클릭/Enter/Space → 우측(모바일은 하단) 정보 패널. 읽기 전용 + 상세 링크만.

// 상태별 노드 색상 — 목록과 동일 팔레트 (queued=파랑/matched=초록/rejected=빨강/cancelled=회색).
const STATUS_FILL: Record<string, string> = {
  queued: "#3b82f6", // blue-500
  matched: "#22c55e", // green-500
  rejected: "#ef4444", // red-500
  cancelled: "#9ca3af", // gray-400
};
const STATUS_FILL_FALLBACK = "#9ca3af";

// 노드 반지름: 인원 수에 비례, min/max clamp.
const MIN_RADIUS = 10;
const MAX_RADIUS = 26;
const CENTER_RADIUS = 30;

// SVG 좌표계(viewBox) — 컨테이너 너비에 맞춰 스케일.
const VIEW = 640;
const CX = VIEW / 2;
const CY = VIEW / 2;

// 링 반지름: 노드 개수에 따라 여러 겹의 동심원에 고르게 분산.
const FIRST_RING = 120;
const RING_GAP = 90;
const MAX_PER_RING = 8;

function nodeRadius(paxCount: number): number {
  // 인원 0~ 기준: 0명=min, 이후 완만히 증가.
  const r = MIN_RADIUS + Math.sqrt(Math.max(paxCount, 0)) * 6;
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r));
}

function statusFill(status: string): string {
  return STATUS_FILL[status] ?? STATUS_FILL_FALLBACK;
}

function statusLabel(status: string): string {
  return REQUEST_STATUS_LABEL[status] ?? status;
}

type PlacedNode = {
  row: RequestRow;
  x: number;
  y: number;
  r: number;
  fill: string;
};

// 결정적 방사형 레이아웃 — 노드를 동심원(ring)들에 고르게 배치.
function layout(rows: RequestRow[]): PlacedNode[] {
  const nodes: PlacedNode[] = [];
  let index = 0;
  let ring = 0;
  let remaining = rows.length;

  while (remaining > 0) {
    // 이 링에 올릴 노드 수: 안쪽 링은 적게, 바깥일수록 더 많이.
    const capacity = ring === 0 ? Math.min(MAX_PER_RING, remaining) : MAX_PER_RING + ring * 4;
    const countOnRing = Math.min(capacity, remaining);
    const ringRadius = FIRST_RING + ring * RING_GAP;
    // 링마다 시작 각도를 어긋나게 해 바퀴살이 겹치지 않도록.
    const angleOffset = (ring % 2) * (Math.PI / countOnRing);

    for (let i = 0; i < countOnRing; i += 1) {
      const row = rows[index];
      const angle = angleOffset + (i / countOnRing) * Math.PI * 2;
      nodes.push({
        row,
        x: CX + Math.cos(angle) * ringRadius,
        y: CY + Math.sin(angle) * ringRadius,
        r: nodeRadius(row.passengerNames.length),
        fill: statusFill(row.status),
      });
      index += 1;
    }

    remaining -= countOnRing;
    ring += 1;
  }

  return nodes;
}

export function RequestGraph({
  requests,
  emptyMessage,
}: {
  requests: RequestRow[];
  emptyMessage: string;
}) {
  const titleId = useId();
  const descId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = useMemo(() => layout(requests), [requests]);

  // 노드 개수에 따라 viewBox를 늘려 바깥 링이 잘리지 않게.
  const maxReach = useMemo(() => {
    let reach = FIRST_RING + CENTER_RADIUS;
    for (const n of nodes) {
      const d = Math.hypot(n.x - CX, n.y - CY) + n.r;
      if (d > reach) reach = d;
    }
    return reach;
  }, [nodes]);

  const pad = 24;
  const half = maxReach + pad;
  const viewBox = `${CX - half} ${CY - half} ${half * 2} ${half * 2}`;

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) ?? null,
    [requests, selectedId],
  );

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 rounded-xl border bg-white p-2 shadow-sm">
        <svg
          viewBox={viewBox}
          role="group"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="h-auto w-full max-w-full touch-manipulation"
          style={{ maxHeight: "70vh" }}
        >
          <title id={titleId}>우리 지구 신청 그래프</title>
          <desc id={descId}>
            중앙 &ldquo;우리 지구&rdquo; 노드를 중심으로 신청 {nodes.length}건이 노드로
            배치된 다이어그램입니다. 각 노드를 선택하면 신청 정보가 표시됩니다.
          </desc>

          {/* 엣지: 중앙 → 각 신청 노드 */}
          <g stroke="#d1d5db" strokeWidth={1.5}>
            {nodes.map((n) => (
              <line key={`edge-${n.row.id}`} x1={CX} y1={CY} x2={n.x} y2={n.y} />
            ))}
          </g>

          {/* 중앙 노드: 우리 지구 */}
          <g>
            <circle cx={CX} cy={CY} r={CENTER_RADIUS} fill="#1f2937" />
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={13}
              fontWeight={600}
              fill="#ffffff"
            >
              우리 지구
            </text>
          </g>

          {/* 신청 노드들 */}
          {nodes.map((n) => {
            const r = n.row;
            const isSelected = r.id === selectedId;
            const pax = r.passengerNames.length;
            const ariaLabel = `${r.regionName ? `${r.regionName} 차량 ` : ""}${DIRECTION_SHORT[r.direction]} ${statusLabel(
              r.status,
            )}, ${r.originLabel}에서 ${r.destLabel}, 학생 ${pax}명`;

            return (
              <g
                key={`node-${r.id}`}
                role="button"
                tabIndex={0}
                aria-label={ariaLabel}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(r.id);
                  }
                }}
                className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-blue-500"
              >
                {/* 터치/클릭 히트 영역 — 보이지 않는 넉넉한 원 (모바일 터치 친화) */}
                <circle cx={n.x} cy={n.y} r={Math.max(n.r + 12, 22)} fill="transparent" />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.fill}
                  stroke={isSelected ? "#2563eb" : "#ffffff"}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <text
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.max(9, Math.min(12, n.r))}
                  fontWeight={600}
                  fill="#ffffff"
                  className="pointer-events-none select-none"
                >
                  {pax}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-2 pb-1 text-xs text-gray-500">
          <span className="text-gray-500">노드 크기 = 인원 ·</span>
          {(["queued", "matched", "rejected", "cancelled"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: statusFill(s) }}
                aria-hidden
              />
              {statusLabel(s)}
            </span>
          ))}
        </div>
      </div>

      {/* 정보 패널 */}
      <aside className="w-full shrink-0 lg:w-72">
        {selected ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-block whitespace-nowrap rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {DIRECTION_SHORT[selected.direction]}
              </span>
              <span
                className="inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: statusFill(selected.status) }}
              >
                {statusLabel(selected.status)}
              </span>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">공급 지구</dt>
                <dd className="text-right font-medium text-gray-800">
                  {selected.regionName ? `${selected.regionName} 차량` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">인원</dt>
                <dd className="font-medium text-gray-800">
                  학생 {selected.passengerNames.length}명
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">경로</dt>
                <dd className="mt-0.5 font-medium text-gray-800">
                  {selected.originLabel} → {selected.destLabel}
                </dd>
              </div>
              {selected.passengerNames.length > 0 && (
                <div>
                  <dt className="text-gray-500">신청 학생</dt>
                  <dd className="mt-0.5 text-gray-700">
                    {selected.passengerNames.slice(0, 3).join(", ")}
                    {selected.passengerNames.length > 3
                      ? ` 외 ${selected.passengerNames.length - 3}명`
                      : ""}
                  </dd>
                </div>
              )}
            </dl>

            <Link
              href={`/operator/requests/${selected.id}`}
              className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              상세 보기 →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-gray-500">
            노드를 선택하면 신청 정보가 표시됩니다.
          </div>
        )}
      </aside>
    </div>
  );
}
