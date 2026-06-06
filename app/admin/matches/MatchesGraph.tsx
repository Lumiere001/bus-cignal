"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { MATCH_STATUS_LABEL, MATCH_STATUS_ORDER } from "@/lib/labels";

// 옵시디언 그래프뷰 (마스터 전국 매칭) — 외부 라이브러리 없이 직접 구현한 force-directed graph.
// 노드 = 지구(공급 또는 신청으로 매칭에 등장한 지구). 노드 크기 ∝ 그 지구의 총 매칭 관여 수.
// 엣지 = 공급 지구 ↔ 신청 지구 매칭 관계. 굵기·라벨 = 그 쌍의 매칭 건수.
// 노드 클릭/Enter/Space → 정보 패널: 공급 입장(보낸 차량에 들어온 매칭 수·상태 분포)
//   + 신청 입장(받은 매칭 수·상태 분포), MATCH_STATUS_LABEL 기준 카운트.
//
// 물리 시뮬레이션(자체 구현, requestAnimationFrame 루프):
//   - many-body charge 반발력(노드끼리 밀어냄)
//   - link spring 인력(엣지로 연결된 노드를 rest length로 당김)
//   - center gravity(전체를 중앙으로 모음)
//   - collision(노드 반지름 + 여유만큼 겹침 방지)
//   - velocity damping + alpha decay 로 부드럽게 정착 후 calm (옵시디언 느낌)
// 상호작용: 노드 드래그(pin), hover/focus 하이라이트, 휠/핀치 zoom, 빈 배경 드래그 pan, 뷰 리셋.
// prefers-reduced-motion: 애니메이션 생략하고 한 번에 정착된 레이아웃으로 단축.

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

// 레이아웃·스케일 상수 ─────────────────────────────────────────────────────
const MIN_RADIUS = 12;
const MAX_RADIUS = 34;
// world 좌표계(viewBox)의 논리 크기. 노드 위치를 이 안에서 시뮬레이트.
const WORLD = 720;
const CENTER = WORLD / 2;

const MIN_EDGE_W = 1.5;
const MAX_EDGE_W = 8;

// 물리 파라미터 — tree-2026 D3 reference 의 비율을 이 좌표계로 옮긴 값.
//   reference: distance 48 · charge -110 · center 0.03 · collide r+4 · velocityDecay(D3 기본 0.4)
// 이 그래프는 노드가 더 크고(12~34) 적으므로 거리·반발을 비례 확대.
const LINK_DISTANCE = 150; // 엣지 rest length (노드 중심 간)
const LINK_STRENGTH = 0.06; // 스프링 강성 (0~1, 매 스텝 보정 비율)
const CHARGE = -2400; // many-body 반발 계수 (음수 = 반발). 거리² 반비례.
const CHARGE_MAX_DIST = 360; // 반발이 작용하는 최대 거리 (멀면 무시 → 안정·성능)
const CENTER_GRAVITY = 0.012; // 중앙으로 끌어당기는 약한 중력
const COLLIDE_PAD = 8; // 충돌 시 노드 반지름에 더하는 여유
const VELOCITY_DECAY = 0.6; // 속도 감쇠 (1 - 0.4 = 0.6 유지 → D3 기본과 동일 느낌)
const ALPHA_DECAY = 0.0228; // alpha 가 매 틱 줄어드는 비율 (D3 기본)
const ALPHA_MIN = 0.001; // 이보다 작아지면 시뮬레이션 정지
const ALPHA_INITIAL = 1; // 시작 alpha
const ALPHA_DRAG_TARGET = 0.3; // 드래그 중 유지할 alphaTarget (계속 살짝 움직임)
const MAX_VELOCITY = 30; // per-step 속도 상한 (폭주 방지)
const SETTLE_ITERATIONS = 400; // reduced-motion 시 한 번에 돌릴 최대 스텝 수

// zoom 한계
const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

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

// 결정적 의사난수 (mulberry32) — index 기반 시드로 초기 위치를 안정·재현 가능하게.
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 시뮬레이션 노드 — 위치·속도·고정좌표(드래그 pin).
type SimNode = {
  id: string;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null; // 고정 x (드래그 중 또는 pin)
  fy: number | null;
};

// 시뮬레이션 엣지 — 인덱스 참조 + 굵기.
type SimEdge = {
  a: number; // source(공급) 노드 인덱스
  b: number; // target(신청) 노드 인덱스
  width: number;
  supplyId: string;
  requestId: string;
  count: number;
};

// 결정적 초기 배치 — 관여 큰 지구를 안쪽, index 시드로 골든앵글 나선에 흩뿌림.
function initSimNodes(nodes: GraphNode[]): SimNode[] {
  const maxTotal = nodes.reduce((m, n) => Math.max(m, n.total), 0);
  const ordered = [...nodes].sort(
    (a, b) => b.total - a.total || a.id.localeCompare(b.id),
  );
  const rand = seededRandom(0x9e3779b9);
  const golden = Math.PI * (3 - Math.sqrt(5)); // 황금각 — 고른 나선 분포
  return ordered.map((n, i) => {
    // 나선 반지름: 안쪽(관여 큰)부터 바깥으로. + 약한 무작위 흔들림(겹침 방지).
    const radius = 30 + Math.sqrt(i + 1) * 46;
    const angle = i * golden;
    const jitter = (rand() - 0.5) * 24;
    return {
      id: n.id,
      r: nodeRadius(n.total, maxTotal),
      x: CENTER + Math.cos(angle) * radius + jitter,
      y: CENTER + Math.sin(angle) * radius + jitter,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    };
  });
}

// 한 틱의 물리 적분 — alpha 에 비례해 힘을 적용. mutate in place, 다음 alpha 반환.
function stepSimulation(
  sim: SimNode[],
  edges: SimEdge[],
  alpha: number,
): number {
  const n = sim.length;

  // 1) many-body charge 반발 (O(n²), 노드 수가 적은 이 그래프에 충분).
  for (let i = 0; i < n; i += 1) {
    const a = sim[i];
    for (let j = i + 1; j < n; j += 1) {
      const b = sim[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distSq = dx * dx + dy * dy;
      if (distSq === 0) {
        // 완전히 겹침 — 결정적 작은 분리.
        dx = (i - j) * 0.5 + 0.5;
        dy = (j - i) * 0.5 + 0.5;
        distSq = dx * dx + dy * dy;
      }
      const dist = Math.sqrt(distSq);
      if (dist > CHARGE_MAX_DIST) continue;
      // 쿨롱 유사: 거리²에 반비례. 너무 가까우면 distSq 하한으로 폭주 방지.
      const force = (CHARGE * alpha) / Math.max(distSq, 25);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // 2) link spring 인력 — rest length 로 당김 (양끝에 절반씩).
  for (const e of edges) {
    const a = sim[e.a];
    const b = sim[e.b];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) {
      dx = 1;
      dy = 0;
      dist = 1;
    }
    const diff = dist - LINK_DISTANCE;
    const k = (diff / dist) * LINK_STRENGTH * alpha;
    const fx = dx * k;
    const fy = dy * k;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // 3) center gravity — 전체를 중앙으로 약하게.
  for (let i = 0; i < n; i += 1) {
    const a = sim[i];
    a.vx += (CENTER - a.x) * CENTER_GRAVITY * alpha;
    a.vy += (CENTER - a.y) * CENTER_GRAVITY * alpha;
  }

  // 4) collision — 겹치는 노드 쌍을 위치 단에서 밀어냄 (속도와 별개로 즉시 분리).
  for (let i = 0; i < n; i += 1) {
    const a = sim[i];
    for (let j = i + 1; j < n; j += 1) {
      const b = sim[j];
      const minDist = a.r + b.r + COLLIDE_PAD;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) continue;
      if (distSq === 0) {
        dx = (j - i) * 0.5 + 0.5;
        dy = 0.5;
        distSq = dx * dx + dy * dy;
      }
      const dist = Math.sqrt(distSq);
      const overlap = ((minDist - dist) / dist) * 0.5;
      const ox = dx * overlap;
      const oy = dy * overlap;
      a.x -= ox;
      a.y -= oy;
      b.x += ox;
      b.y += oy;
    }
  }

  // 5) 속도 적분 + damping + pin 처리.
  for (let i = 0; i < n; i += 1) {
    const a = sim[i];
    a.vx *= VELOCITY_DECAY;
    a.vy *= VELOCITY_DECAY;
    // 속도 상한 (수치 폭주 방지).
    if (a.vx > MAX_VELOCITY) a.vx = MAX_VELOCITY;
    else if (a.vx < -MAX_VELOCITY) a.vx = -MAX_VELOCITY;
    if (a.vy > MAX_VELOCITY) a.vy = MAX_VELOCITY;
    else if (a.vy < -MAX_VELOCITY) a.vy = -MAX_VELOCITY;

    if (a.fx !== null) {
      a.x = a.fx;
      a.vx = 0;
    } else {
      a.x += a.vx;
    }
    if (a.fy !== null) {
      a.y = a.fy;
      a.vy = 0;
    } else {
      a.y += a.vy;
    }
  }

  return alpha + (0 - alpha) * ALPHA_DECAY; // alpha decay (목표 0으로 수렴)
}

// 뷰 변환 — pan(x,y) + zoom(k). 화면 = world * k + pan.
type View = { x: number; y: number; k: number };

// 렌더용 위치 스냅샷 (index = simNodes index).
type XY = { x: number; y: number };

// 상태 분포 한 줄(칩 묶음) — 패널에서 공급/신청 각각에 사용.
function StatusChips({
  byStatus,
  total,
}: {
  byStatus: StatusCount[];
  total: number;
}) {
  if (total === 0) {
    return <p className="text-gray-400">해당 없음</p>;
  }
  const ordered = [...byStatus].sort(
    (a, b) =>
      (MATCH_STATUS_ORDER[a.status] ?? 99) - (MATCH_STATUS_ORDER[b.status] ?? 99),
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
  const svgRef = useRef<SVGSVGElement | null>(null);

  // 선택(클릭) / 강조(hover·focus) 상태.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // 렌더용 위치 스냅샷 — RAF 루프가 매 틱 publish, 렌더는 이 state 만 읽음
  // (물리 적분은 simRef 버퍼에서 하고, 렌더 중 ref 접근은 하지 않음).
  // 초기값은 빈 배열 — 마운트 effect 가 즉시 publish() 로 채운다(렌더는 meta 좌표로 fallback).
  const [positions, setPositions] = useState<XY[]>([]);

  // prefers-reduced-motion 감지 (SSR 안전: effect 안에서만 접근).
  const reducedMotionRef = useRef(false);

  // 노드 인덱스 ↔ id 매핑, 인접 정보.
  const { simNodesInit, simEdges, indexById, neighbors } =
    useMemo(() => {
      const init = initSimNodes(data.nodes);
      const idxById = new Map<string, number>();
      init.forEach((s, i) => idxById.set(s.id, i));

      const sEdges: SimEdge[] = [];
      const maxCount = data.edges.reduce((m, e) => Math.max(m, e.count), 0);
      const nbrs = new Map<string, Set<string>>();
      for (const s of init) nbrs.set(s.id, new Set());

      for (const e of data.edges) {
        const ai = idxById.get(e.supplyId);
        const bi = idxById.get(e.requestId);
        if (ai === undefined || bi === undefined) continue;
        sEdges.push({
          a: ai,
          b: bi,
          width: edgeWidth(e.count, maxCount),
          supplyId: e.supplyId,
          requestId: e.requestId,
          count: e.count,
        });
        nbrs.get(e.supplyId)?.add(e.requestId);
        nbrs.get(e.requestId)?.add(e.supplyId);
      }
      return {
        simNodesInit: init,
        simEdges: sEdges,
        indexById: idxById,
        neighbors: nbrs,
      };
    }, [data.nodes, data.edges]);

  // 실시간 위치를 담는 ref (RAF 가 mutate). data 가 바뀌면 새 초기 배치로 교체.
  const simRef = useRef<SimNode[]>(simNodesInit);
  const alphaRef = useRef<number>(ALPHA_INITIAL);
  const rafRef = useRef<number | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  // 단일 RAF 루프 — 항상 rafRef 를 통해 1개만 돈다 (이중 루프 방지).
  const loopRef = useRef<() => void>(() => {});

  // 물리 버퍼(simRef)의 현재 위치를 렌더용 state 로 publish (매 틱 새 배열).
  const publish = useCallback(() => {
    setPositions(simRef.current.map((s) => ({ x: s.x, y: s.y })));
  }, []);

  // 루프가 멈춰 있으면 시작 (이미 돌고 있으면 no-op). reduced-motion 이면 가만히.
  const ensureRunning = useCallback(() => {
    if (reducedMotionRef.current) return;
    if (rafRef.current === null && simRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(loopRef.current);
    }
  }, []);

  // id → GraphNode 룩업 (라벨·aria·패널용).
  const nodeById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data.nodes]);

  // 뷰 변환 (pan/zoom). React state 로 두어 reset·버튼이 즉시 반영되게.
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  // 포인터 핸들러에서 최신 view 를 읽기 위한 mirror ref (effect 에서만 갱신 — 렌더 중 접근 금지).
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // 활성(강조 기준) 노드 = hover 우선, 없으면 selected.
  const activeId = hoverId ?? selectedId;

  // ── 시뮬레이션 부트스트랩: data 가 바뀌면 위치·alpha 리셋하고 RAF 시작. ──
  useEffect(() => {
    // reduced-motion 확인.
    const mq =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    reducedMotionRef.current = mq?.matches ?? false;

    // 새 초기 배치로 교체 (data 변경 시).
    simRef.current = simNodesInit.map((s) => ({ ...s }));
    alphaRef.current = ALPHA_INITIAL;

    if (simRef.current.length === 0) {
      publish();
      return;
    }

    if (reducedMotionRef.current) {
      // 모션 비선호: 애니메이션 없이 한 번에 정착시킨 뒤 그대로 표시.
      let alpha = ALPHA_INITIAL;
      for (let i = 0; i < SETTLE_ITERATIONS && alpha > ALPHA_MIN; i += 1) {
        alpha = stepSimulation(simRef.current, simEdges, alpha);
      }
      alphaRef.current = 0;
      publish();
      return;
    }

    // 단일 루프 본체 — loopRef 에 저장해 effect·reheat 가 동일 인스턴스를 재사용.
    loopRef.current = () => {
      // 드래그 중이면 alpha 를 살려 둠(계속 미세하게 재배치).
      if (draggingIdRef.current !== null) {
        if (alphaRef.current < ALPHA_DRAG_TARGET) {
          alphaRef.current = ALPHA_DRAG_TARGET;
        }
      }
      alphaRef.current = stepSimulation(
        simRef.current,
        simEdges,
        alphaRef.current,
      );
      publish();
      if (alphaRef.current > ALPHA_MIN || draggingIdRef.current !== null) {
        rafRef.current = requestAnimationFrame(loopRef.current);
      } else {
        rafRef.current = null;
      }
    };
    // 초기 스냅샷 publish 후 루프 시작.
    publish();
    rafRef.current = requestAnimationFrame(loopRef.current);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [simNodesInit, simEdges, publish]);

  // alpha 를 다시 데워 RAF 를 재가동 (드래그·상호작용 후 정착이 멈춰 있을 때).
  const reheat = useCallback(
    (target: number) => {
      if (reducedMotionRef.current) return; // 모션 비선호면 가만히.
      if (alphaRef.current < target) alphaRef.current = target;
      ensureRunning();
    },
    [ensureRunning],
  );

  // ── 좌표 변환 헬퍼: 화면(client) → world. zoom/pan 역변환. ──
  const clientToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      // svg 는 viewBox 0..WORLD 를 rect 에 fit (preserveAspectRatio 기본 = meet, 정사각이라 균일).
      const scale = rect.width / WORLD; // 정사각 viewBox + 정사각 표시.
      const localX = (clientX - rect.left) / scale; // viewBox 좌표
      const localY = (clientY - rect.top) / scale;
      const v = viewRef.current;
      // 화면 viewBox 좌표 = world * k + pan  →  world = (local - pan) / k
      return { x: (localX - v.x) / v.k, y: (localY - v.y) / v.k };
    },
    [],
  );

  // ── 노드 드래그 (Pointer Events: 마우스·터치·펜 통합) ──
  // 드래그 시작점·실제 이동거리 추적 — 진짜 드래그면 뒤따르는 click 의 선택 토글을 억제.
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const DRAG_THRESHOLD = 4; // px, 이보다 적게 움직이면 탭(클릭)으로 간주

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const idx = indexById.get(id);
      if (idx === undefined) return;
      draggingIdRef.current = id;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = false;
      const w = clientToWorld(e.clientX, e.clientY);
      const node = simRef.current[idx];
      node.fx = w.x;
      node.fy = w.y;
      reheat(ALPHA_DRAG_TARGET);
    },
    [indexById, clientToWorld, reheat],
  );

  const onNodePointerMove = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (draggingIdRef.current !== id) return;
      const idx = indexById.get(id);
      if (idx === undefined) return;
      const start = dragStartRef.current;
      if (start && !movedRef.current) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD) {
          movedRef.current = true;
        }
      }
      const w = clientToWorld(e.clientX, e.clientY);
      const node = simRef.current[idx];
      node.fx = w.x;
      node.fy = w.y;
    },
    [indexById, clientToWorld],
  );

  const onNodePointerUp = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (draggingIdRef.current !== id) return;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      draggingIdRef.current = null;
      dragStartRef.current = null;
      const idx = indexById.get(id);
      if (idx !== undefined) {
        // pin 해제 — 물리 재개 (D3 drag end 와 동일).
        const node = simRef.current[idx];
        node.fx = null;
        node.fy = null;
      }
      reheat(0.1);
    },
    [indexById, reheat],
  );

  // ── 배경 pan 드래그 (빈 곳을 끌면 전체 이동) ──
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const onBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 노드가 stopPropagation 하므로 여기 도달 = 빈 배경.
      svgRef.current?.setPointerCapture?.(e.pointerId);
      panStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: viewRef.current.x,
        origY: viewRef.current.y,
      };
      // 빈 배경 클릭 = 선택 해제 (옵시디언 느낌).
      setSelectedId(null);
    },
    [],
  );

  const onBackgroundPointerMove = useCallback((e: React.PointerEvent) => {
    const pan = panStateRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / WORLD; // client px → viewBox 단위
    const dx = (e.clientX - pan.startX) / scale;
    const dy = (e.clientY - pan.startY) / scale;
    setView((v) => ({ ...v, x: pan.origX + dx, y: pan.origY + dy }));
  }, []);

  const onBackgroundPointerUp = useCallback((e: React.PointerEvent) => {
    if (panStateRef.current?.pointerId === e.pointerId) {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
      panStateRef.current = null;
    }
  }, []);

  // ── 휠 zoom (커서 지점을 고정점으로) ──
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / WORLD;
    const localX = (e.clientX - rect.left) / scale;
    const localY = (e.clientY - rect.top) / scale;
    setView((v) => {
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nextK = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.k * factor));
      if (nextK === v.k) return v;
      // 커서 아래 world 점이 화면상 그대로 유지되도록 pan 보정.
      // local = world*k + pan  →  고정: (local - x)/k 불변
      const wx = (localX - v.x) / v.k;
      const wy = (localY - v.y) / v.k;
      return { k: nextK, x: localX - wx * nextK, y: localY - wy * nextK };
    });
  }, []);

  const resetView = useCallback(() => {
    setView({ x: 0, y: 0, k: 1 });
  }, []);

  const selected = useMemo(
    () => (selectedId ? (nodeById.get(selectedId) ?? null) : null),
    [nodeById, selectedId],
  );

  // 렌더 모델 — 정적 메타(id·r)와 라이브 위치(positions state)를 인덱스로 join.
  // positions 가 아직 새 data 길이로 갱신되기 전 한 프레임을 방어하기 위해 fallback 좌표 사용.
  const sim = simNodesInit.map((meta, i) => {
    const p = positions[i];
    return {
      id: meta.id,
      r: meta.r,
      x: p ? p.x : meta.x,
      y: p ? p.y : meta.y,
    };
  });

  if (data.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  // 강조 대상 집합 (active 노드 + 이웃).
  const activeNeighbors = activeId ? neighbors.get(activeId) : undefined;
  const isFaded = (id: string): boolean => {
    if (!activeId) return false;
    if (id === activeId) return false;
    return !(activeNeighbors?.has(id) ?? false);
  };
  const edgeIsActive = (supplyId: string, requestId: string): boolean =>
    activeId !== null && (supplyId === activeId || requestId === activeId);

  // viewBox 는 고정(0..WORLD). pan/zoom 은 내부 <g transform> 으로.
  const viewBox = `0 0 ${WORLD} ${WORLD}`;
  const gTransform = `translate(${view.x} ${view.y}) scale(${view.k})`;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="relative min-w-0 flex-1 rounded-xl border bg-white p-2 shadow-sm">
        {/* 뷰 컨트롤 */}
        <div className="absolute right-3 top-3 z-10 flex gap-1">
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border bg-white/90 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm backdrop-blur hover:bg-white hover:text-gray-900"
            aria-label="뷰 초기화 (확대·이동 리셋)"
          >
            뷰 초기화
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox={viewBox}
          role="group"
          aria-labelledby={titleId}
          className="h-auto w-full touch-none select-none"
          style={{ maxHeight: "72vh", cursor: "grab" }}
          onPointerDown={onBackgroundPointerDown}
          onPointerMove={onBackgroundPointerMove}
          onPointerUp={onBackgroundPointerUp}
          onPointerLeave={onBackgroundPointerUp}
          onWheel={onWheel}
        >
          <title id={titleId}>전국 지구 매칭 그래프</title>

          {/* 투명 배경 — pan 드래그·빈 곳 클릭 타깃 (viewBox 전체) */}
          <rect x={0} y={0} width={WORLD} height={WORLD} fill="transparent" />

          <g transform={gTransform}>
            {/* 엣지: 공급 지구 ↔ 신청 지구 (굵기·라벨 = 매칭 건수) */}
            <g>
              {simEdges.map((e) => {
                const a = sim[e.a];
                const b = sim[e.b];
                if (!a || !b) return null;
                const active = edgeIsActive(e.supplyId, e.requestId);
                const faded =
                  activeId !== null &&
                  !active &&
                  isFaded(e.supplyId) &&
                  isFaded(e.requestId);
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                return (
                  <g
                    key={`edge-${e.supplyId}-${e.requestId}`}
                    opacity={faded ? 0.12 : activeId && !active ? 0.4 : 1}
                  >
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={active ? "#2563eb" : "#cbd5e1"}
                      strokeWidth={e.width / view.k + (active ? 0.5 : 0)}
                      strokeLinecap="round"
                    />
                    {/* 건수 라벨 — 강조 중이거나 충분히 확대됐을 때만(겹침·잡음 방지) */}
                    {(active || view.k >= 1.15) && (
                      <g>
                        <circle
                          cx={mx}
                          cy={my}
                          r={9 / view.k}
                          fill="#ffffff"
                          stroke="#e2e8f0"
                          strokeWidth={1 / view.k}
                        />
                        <text
                          x={mx}
                          y={my}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={10 / view.k}
                          fontWeight={600}
                          fill={active ? "#2563eb" : "#64748b"}
                          className="pointer-events-none select-none"
                        >
                          {e.count}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 지구 노드들 */}
            {sim.map((s) => {
              const node = nodeById.get(s.id);
              if (!node) return null;
              const isSelected = s.id === selectedId;
              const isActive = s.id === activeId;
              const faded = isFaded(s.id);
              const ariaLabel = `${node.name} 지구, 총 매칭 ${node.total}건 (공급 ${node.asSupply.total}건, 신청 ${node.asRequest.total}건)`;
              const labelFont = Math.max(10, Math.min(13, s.r * 0.55)) / view.k;
              // 라벨 표시: 활성/선택, 큰 노드, 또는 충분히 확대됐을 때 (가독성·잡음 균형).
              const showLabel =
                isActive || isSelected || s.r >= 22 || view.k >= 1.1;

              return (
                <g
                  key={`node-${s.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                  opacity={faded ? 0.25 : 1}
                  onPointerDown={(e) => onNodePointerDown(e, s.id)}
                  onPointerMove={(e) => onNodePointerMove(e, s.id)}
                  onPointerUp={(e) => onNodePointerUp(e, s.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 진짜 드래그 뒤의 click 은 선택 토글하지 않음 (탭만 토글).
                    if (movedRef.current) {
                      movedRef.current = false;
                      return;
                    }
                    setSelectedId((cur) => (cur === s.id ? null : s.id));
                  }}
                  onPointerEnter={() => setHoverId(s.id)}
                  onPointerLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(s.id)}
                  onBlur={() => setHoverId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId((cur) => (cur === s.id ? null : s.id));
                    }
                  }}
                  className="cursor-pointer outline-none focus-visible:[&>circle:nth-of-type(2)]:stroke-blue-500"
                  style={{ cursor: "pointer" }}
                >
                  {/* 터치/클릭·드래그 히트 영역 — 보이지 않는 넉넉한 원 */}
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={Math.max(s.r + 12, 24)}
                    fill="transparent"
                  />
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={s.r}
                    fill={isActive ? "#111827" : "#1f2937"}
                    stroke={
                      isSelected ? "#2563eb" : isActive ? "#60a5fa" : "#ffffff"
                    }
                    strokeWidth={(isSelected ? 3 : isActive ? 2.5 : 2) / view.k}
                  />
                  <text
                    x={s.x}
                    y={s.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={labelFont}
                    fontWeight={600}
                    fill="#ffffff"
                    className="pointer-events-none select-none"
                  >
                    {node.total}
                  </text>
                  {/* 지구명 — 노드 아래 라벨 */}
                  {showLabel && (
                    <text
                      x={s.x}
                      y={s.y + s.r + 12 / view.k}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11 / view.k}
                      fontWeight={isSelected || isActive ? 700 : 500}
                      fill={isSelected || isActive ? "#2563eb" : "#475569"}
                      className="pointer-events-none select-none"
                    >
                      {node.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-2 pb-1 text-xs text-gray-500">
          <span className="text-gray-400">
            노드 크기·숫자 = 매칭 관여 수 · 엣지 굵기·숫자 = 쌍 매칭 건수 · 드래그·휠로
            이동·확대 ·
          </span>
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
              <h2 className="text-base font-semibold text-gray-900">
                {selected.name}
              </h2>
              <span className="whitespace-nowrap rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                총 {selected.total}건
              </span>
            </div>

            <section className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">공급 (보낸 차량)</span>
                <span className="tabular-nums text-gray-500">
                  {selected.asSupply.total}건
                </span>
              </div>
              <StatusChips
                byStatus={selected.asSupply.byStatus}
                total={selected.asSupply.total}
              />
            </section>

            <section>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">신청 (우리 학생)</span>
                <span className="tabular-nums text-gray-500">
                  {selected.asRequest.total}건
                </span>
              </div>
              <StatusChips
                byStatus={selected.asRequest.byStatus}
                total={selected.asRequest.total}
              />
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
