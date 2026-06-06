import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { MatchesView, type MatchRow } from "./MatchesView";
import type {
  GraphEdge,
  GraphNode,
  MatchesGraphData,
  StatusCount,
} from "./MatchesGraph";

export const dynamic = "force-dynamic";

// SPEC §4.4 — 마스터 전국 매칭(읽기 모니터링). 목록 + 옵시디언풍 그래프 토글.
// 개인정보 최소: 학생 이름·전화 노출 안 함(지구·상태·금액·시각 + 지구별 집계만).

type Row = {
  id: string;
  status: string;
  matched_at: string;
  trip: {
    price_per_seat: number;
    supply: { id: string; name: string } | null;
  } | null;
  request: { region: { id: string; name: string } | null } | null;
};

async function loadMatches() {
  const db = createAdminClient();
  const { data } = await db
    .from("matches")
    .select(
      `
      id, status, matched_at,
      trip:trips!trip_id(price_per_seat, supply:regions!operator_region_id(id, name)),
      request:seat_requests!request_id(region:regions!region_id(id, name))
    `,
    )
    .order("matched_at", { ascending: false })
    .limit(200);
  return (data as Row[] | null) ?? [];
}

// 지구별 매칭 관여 집계 (공급/신청 입장 + 상태 분포) 빌더.
// matches → trips.operator_region_id = 공급 지구, seat_requests.region_id = 신청 지구.
type RoleAgg = { total: number; byStatus: Map<string, number> };
type NodeAgg = {
  id: string;
  name: string;
  asSupply: RoleAgg;
  asRequest: RoleAgg;
};

function emptyRole(): RoleAgg {
  return { total: 0, byStatus: new Map() };
}

function bumpRole(role: RoleAgg, status: string) {
  role.total += 1;
  role.byStatus.set(status, (role.byStatus.get(status) ?? 0) + 1);
}

function toStatusCounts(byStatus: Map<string, number>): StatusCount[] {
  return [...byStatus.entries()].map(([status, count]) => ({ status, count }));
}

function buildGraph(matches: Row[]): MatchesGraphData {
  const nodeMap = new Map<string, NodeAgg>();
  // 무방향 쌍 카운트: 공급 지구 ↔ 신청 지구. (방향은 노드 패널이 표현)
  const edgeMap = new Map<string, GraphEdge>();

  const ensureNode = (id: string, name: string): NodeAgg => {
    let n = nodeMap.get(id);
    if (!n) {
      n = { id, name, asSupply: emptyRole(), asRequest: emptyRole() };
      nodeMap.set(id, n);
    }
    return n;
  };

  for (const m of matches) {
    const trip = one(m.trip);
    const request = one(m.request);
    const supply = one(trip?.supply ?? null);
    const reqRegion = one(request?.region ?? null);
    if (!supply || !reqRegion) continue; // 지구 정보 없는 매칭은 그래프에서 제외

    const supplyNode = ensureNode(supply.id, supply.name);
    bumpRole(supplyNode.asSupply, m.status);

    const requestNode = ensureNode(reqRegion.id, reqRegion.name);
    bumpRole(requestNode.asRequest, m.status);

    // 엣지 키: 공급→신청 방향 유지 (같은 두 지구라도 역방향은 별도 쌍).
    const key = `${supply.id}__${reqRegion.id}`;
    const edge = edgeMap.get(key);
    if (edge) {
      edge.count += 1;
    } else {
      edgeMap.set(key, { supplyId: supply.id, requestId: reqRegion.id, count: 1 });
    }
  }

  const nodes: GraphNode[] = [...nodeMap.values()].map((n) => ({
    id: n.id,
    name: n.name,
    total: n.asSupply.total + n.asRequest.total,
    asSupply: {
      total: n.asSupply.total,
      byStatus: toStatusCounts(n.asSupply.byStatus),
    },
    asRequest: {
      total: n.asRequest.total,
      byStatus: toStatusCounts(n.asRequest.byStatus),
    },
  }));

  return { nodes, edges: [...edgeMap.values()] };
}

export default async function AdminMatchesPage() {
  const matches = await loadMatches();

  const rows: MatchRow[] = matches.map((m) => {
    const trip = one(m.trip);
    const request = one(m.request);
    return {
      id: m.id,
      status: m.status,
      matchedAt: m.matched_at,
      pricePerSeat: trip?.price_per_seat ?? null,
      supplyName: one(trip?.supply ?? null)?.name ?? "—",
      requestName: one(request?.region ?? null)?.name ?? "—",
    };
  });

  const graph = buildGraph(matches);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">전체 매칭</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          전국 매칭 최근 {matches.length}건 · {graph.nodes.length}개 지구 · 매칭순 (읽기, 학생 개인정보 비노출)
        </p>
      </div>

      <MatchesView rows={rows} graph={graph} />
    </main>
  );
}
