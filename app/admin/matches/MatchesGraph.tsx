"use client";

import { useId, useMemo, useState } from "react";
import { MATCH_STATUS_LABEL, MATCH_STATUS_ORDER } from "@/lib/labels";

// 옵시디언 그래프뷰 (마스터 전국 매칭) — 외부 라이브러리 없이 인라인 SVG.
// 노드 = 지구(공급 또는 신청으로 매칭에 등장한 지구). 노드 크기 ∝ 그 지구의 총 매칭 관여 수.
// 엣지 = 공급 지구 ↔ 신청 지구 매칭 관계. 굵기·라벨 = 그 쌍의 매칭 건수.
// 노드 클릭/Enter/Space → 정보 패널: 공급 입장(보낸 차량에 들어온 매칭 수·상태 분포)
//   + 신청 입장(받은 매칭 수·상태 분포), MATCH_STATUS_LABEL 기준 카운트.

// 매칭 상태별 색상 — RequestGraph 팔레트와 동일 의미축(진행=파랑/초록, 종료=회색/빨강).
const STATUS_FILL: Record<string, string> = {
  awaiting_payment: "#3b82f6", // blue-500 — 송금 대기
  payment_reported: "#f59e0b", // amber-500 — 송금 보고됨(확인 전)
  paid: "#22c55e", // green-500 — 입금 확인
  expired: "#ef4444", // red-500 — 자리 풀림
  cancelled: "#9ca3af", // gray-400 — 취소
};
const STATUS_FILL_FALLBACK = "#9ca3af";

// 상태 표시 순서 — 생애주기 순(MATCH_STATUS_ORDER). 범례·분포 모두 동일 순서.
const STATUS_KEYS = Object.keys(MATCH_STATUS_LABEL).sort(
  (a, b) => (MATCH_STATUS_ORDER[a] ?? 99) - (MATCH_STATUS_ORDER[b] ?? 99),
);

function statusFill(status: string): string {
  return STATUS_FILL[status] ?? STATUS_FILL_FALLBACK;
}

function statusLabel(status: string): string {
  return MATCH_STATUS_LABEL[status] ?? status;
}

// page.tsx에서 서버 집계 후 넘어오는 직렬화 구조 ──────────────────────────────
export type StatusCount = { status: string; count: number };

export type GraphNode = {
  /** regions.id — 노드 식별자 */
  id: string;
  name: string;
  /** 총 관여 매칭 수 (공급 + 신청). 노드 크기 기준 */
  total: number;
  /** 공급(우리 차량에 들어온) 입장 */
  asSupply: { total: number; byStatus: StatusCount[] };
  /** 신청(우리 학생이 받은) 입장 */
  asRequest: { total: number; byStatus: StatusCount[] };
};

export type GraphEdge = {
  /** 공급 지구 region id */
  supplyId: string;
  /** 신청 지구 region id */
  requestId: string;
  /** 그 쌍의 매칭 건수 */
  count: number;
};

export type MatchesGraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

// 레이아웃 상수 ───────────────────────────────────────────────────────────
const MIN_RADIUS = 12;
const MAX_RADIUS = 34;
const VIEW = 720;
const CX = VIEW / 2;
const CY = VIEW / 2;
const FIRST_RING = 150;
const RING_GAP = 110;
const MAX_PER_RING = 10;

const MIN_EDGE_W = 1.5;
const MAX_EDGE_W = 8;

type PlacedNode = GraphNode & {
  x: number;
  y: number;
  r: number;
};

// 노드 반지름 — 관여 수에 비례, 전체 최대치로 정규화 후 sqrt 스케일 + clamp.
function nodeRadius(total: number, maxTotal: number): number {
  if (maxTotal <= 0) return MIN_RADIUS;
  const ratio = Math.sqrt(total / maxTotal); // 0~1
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
}

// 엣지 굵기 — 쌍 매칭 건수에 비례, 최대치로 정규화 후 clamp.
function edgeWidth(count: number, maxCount: number): number {
  if (maxCount <= 0) return MIN_EDGE_W;
  const ratio = count / maxCount;
  return MIN_EDGE_W + ratio * (MAX_EDGE_W - MIN_EDGE_W);
}

// 결정적 방사형 레이아웃 — 관여 수 내림차순으로 정렬해 중심 가까운 안쪽 링부터 배치.
function layout(nodes: GraphNode[]): PlacedNode[] {
  const maxTotal = nodes.reduce((m, n) => Math.max(m, n.total), 0);
  // 관여 큰 지구가 안쪽(중앙 근처), id로 안정 정렬해 결정적.
  const ordered = [...nodes].sort(
    (a, b) => b.total - a.total || a.id.localeCompare(b.id),
  );

  const placed: PlacedNode[] = [];
  let index = 0;
  let ring = 0;
  let remaining = ordered.length;

  while (remaining > 0) {
    const capacity = ring === 0 ? Math.min(MAX_PER_RING, remaining) : MAX_PER_RING + ring * 4;
    const countOnRing = Math.min(capacity, remaining);
    const ringRadius = FIRST_RING + ring * RING_GAP;
    // 링마다 시작 각도를 어긋나게 해 바퀴살이 겹치지 않도록.
    const angleOffset = (ring % 2) * (Math.PI / countOnRing);

    for (let i = 0; i < countOnRing; i += 1) {
      const node = ordered[index];
      // -90°(상단)부터 시계방향으로 — 첫 노드가 위쪽에 오도록.
      const angle = angleOffset + (i / countOnRing) * Math.PI * 2 - Math.PI / 2;
      placed.push({
        ...node,
        x: CX + Math.cos(angle) * ringRadius,
        y: CY + Math.sin(angle) * ringRadius,
        r: nodeRadius(node.total, maxTotal),
      });
      index += 1;
    }

    remaining -= countOnRing;
    ring += 1;
  }

  return placed;
}

// 상태 분포 한 줄(칩 묶음) — 패널에서 공급/신청 각각에 사용.
function StatusChips({ byStatus, total }: { byStatus: StatusCount[]; total: number }) {
  if (total === 0) {
    return <p className="text-gray-400">해당 없음</p>;
  }
  // byStatus를 상태 순서로 정렬.
  const ordered = [...byStatus].sort(
    (a, b) => (MATCH_STATUS_ORDER[a.status] ?? 99) - (MATCH_STATUS_ORDER[b.status] ?? 99),
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((s) => (
        <span
          key={s.status}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: statusFill(s.status) }}
        >
          {statusLabel(s.status)} {s.count}
        </span>
      ))}
    </div>
  );
}

export function MatchesGraph({
  data,
  emptyMessage,
}: {
  data: MatchesGraphData;
  emptyMessage: string;
}) {
  const titleId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const placed = useMemo(() => layout(data.nodes), [data.nodes]);

  // id → 배치 좌표 룩업 (엣지 그릴 때 사용).
  const byId = useMemo(() => {
    const m = new Map<string, PlacedNode>();
    for (const n of placed) m.set(n.id, n);
    return m;
  }, [placed]);

  const maxEdgeCount = useMemo(
    () => data.edges.reduce((m, e) => Math.max(m, e.count), 0),
    [data.edges],
  );

  // viewBox — 가장 바깥 노드까지 + 패딩으로 클리핑 방지.
  const half = useMemo(() => {
    let reach = FIRST_RING;
    for (const n of placed) {
      const d = Math.hypot(n.x - CX, n.y - CY) + n.r;
      if (d > reach) reach = d;
    }
    return reach + 28;
  }, [placed]);

  const viewBox = `${CX - half} ${CY - half} ${half * 2} ${half * 2}`;

  const selected = useMemo(
    () => data.nodes.find((n) => n.id === selectedId) ?? null,
    [data.nodes, selectedId],
  );

  if (data.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
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
          className="h-auto w-full touch-manipulation"
          style={{ maxHeight: "72vh" }}
        >
          <title id={titleId}>전국 지구 매칭 그래프</title>

          {/* 엣지: 공급 지구 ↔ 신청 지구 (굵기·라벨 = 매칭 건수) */}
          <g>
            {data.edges.map((e) => {
              const a = byId.get(e.supplyId);
              const b = byId.get(e.requestId);
              if (!a || !b) return null;
              const active =
                selectedId === e.supplyId || selectedId === e.requestId;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              return (
                <g key={`edge-${e.supplyId}-${e.requestId}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={active ? "#2563eb" : "#cbd5e1"}
                    strokeWidth={edgeWidth(e.count, maxEdgeCount)}
                    strokeLinecap="round"
                    opacity={selectedId && !active ? 0.25 : 1}
                  />
                  {/* 건수 라벨 — 가독성 위해 흰 배경 칩 */}
                  <g opacity={selectedId && !active ? 0.3 : 1}>
                    <circle cx={mx} cy={my} r={9} fill="#ffffff" stroke="#e2e8f0" strokeWidth={1} />
                    <text
                      x={mx}
                      y={my}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fontWeight={600}
                      fill={active ? "#2563eb" : "#64748b"}
                      className="pointer-events-none select-none"
                    >
                      {e.count}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* 지구 노드들 */}
          {placed.map((n) => {
            const isSelected = n.id === selectedId;
            const ariaLabel = `${n.name} 지구, 총 매칭 ${n.total}건 (공급 ${n.asSupply.total}건, 신청 ${n.asRequest.total}건)`;
            const labelFont = Math.max(10, Math.min(13, n.r * 0.55));

            return (
              <g
                key={`node-${n.id}`}
                role="button"
                tabIndex={0}
                aria-label={ariaLabel}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(n.id);
                  }
                }}
                className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-blue-500"
              >
                {/* 터치/클릭 히트 영역 — 보이지 않는 넉넉한 원 */}
                <circle cx={n.x} cy={n.y} r={Math.max(n.r + 12, 24)} fill="transparent" />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill="#1f2937"
                  stroke={isSelected ? "#2563eb" : "#ffffff"}
                  strokeWidth={isSelected ? 3 : 2}
                  opacity={selectedId && !isSelected ? 0.55 : 1}
                />
                <text
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={labelFont}
                  fontWeight={600}
                  fill="#ffffff"
                  className="pointer-events-none select-none"
                >
                  {n.total}
                </text>
                {/* 지구명 — 노드 아래 라벨 */}
                <text
                  x={n.x}
                  y={n.y + n.r + 12}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={isSelected ? 700 : 500}
                  fill={isSelected ? "#2563eb" : "#475569"}
                  className="pointer-events-none select-none"
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-2 pb-1 text-xs text-gray-500">
          <span className="text-gray-400">노드 크기·숫자 = 매칭 관여 수 · 엣지 굵기·숫자 = 쌍 매칭 건수 ·</span>
          {STATUS_KEYS.map((s) => (
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
      <aside className="w-full shrink-0 lg:w-80">
        {selected ? (
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">{selected.name}</h2>
              <span className="whitespace-nowrap rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                총 {selected.total}건
              </span>
            </div>

            <section className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">공급 (보낸 차량)</span>
                <span className="tabular-nums text-gray-500">{selected.asSupply.total}건</span>
              </div>
              <StatusChips byStatus={selected.asSupply.byStatus} total={selected.asSupply.total} />
            </section>

            <section>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">신청 (우리 학생)</span>
                <span className="tabular-nums text-gray-500">{selected.asRequest.total}건</span>
              </div>
              <StatusChips byStatus={selected.asRequest.byStatus} total={selected.asRequest.total} />
            </section>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-gray-400">
            노드를 선택하면 지구별 공급·신청 매칭 현황이 표시됩니다.
          </div>
        )}
      </aside>
    </div>
  );
}
