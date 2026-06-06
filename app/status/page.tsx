import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { StatusView, type RegionSupply } from "./StatusView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "전국 잔여석 현황 — Bus Cignal",
  description:
    "CCC 전국 여름 수련회 지구별 차량 잔여석·대기 신청 현황 실시간 요약 (무로그인 공개).",
};

// 매칭이 잡혀 좌석을 점유 중인 상태(=잔여석에서 차감) — operator 대시보드와 동일 정의.
const ACTIVE_MATCH = ["awaiting_payment", "payment_reported", "paid"];

/**
 * 무로그인·무PII 전국 현황 집계.
 *
 * createAdminClient는 RLS를 우회하지만, 이 페이지가 클라이언트로 내보내는 값은
 * 전부 "지구명 + 숫자(차량 수/정원/잔여석/대기 건수·인원)"뿐이다.
 * 학생 이름·전화·예약번호·간사 이름·차량 간사 연락처 등 PII는 한 글자도 select 하지 않는다.
 */
async function loadStatus(): Promise<RegionSupply[]> {
  const db = createAdminClient();

  // 공급: published 차량 + 좌석 슬라이스 + 매칭 상태 (PII 컬럼 미포함).
  // 공급 지구명은 operator_region_id로 묶인 regions.name만 가져온다.
  const { data: trips } = await db
    .from("trips")
    .select(
      `direction, capacity,
       supply:regions!operator_region_id(id, name),
       seat_offers(seat_count, status),
       matches(status)`,
    )
    .eq("status", "published");

  // 수요: 대기(queued) 신청 — region_id별 건수/인원만. 학생·간사 식별 컬럼은 select 안 함.
  const { data: queued } = await db
    .from("seat_requests")
    .select("region_id, seat_count")
    .eq("status", "queued");

  type Acc = {
    regionId: string;
    regionName: string;
    tripCount: number;
    totalCapacity: number;
    available: number;
    upTrips: number;
    upAvailable: number;
    downTrips: number;
    downAvailable: number;
    waitingTeams: number;
    waitingPeople: number;
  };

  const byRegion = new Map<string, Acc>();

  const ensure = (id: string, name: string): Acc => {
    let acc = byRegion.get(id);
    if (!acc) {
      acc = {
        regionId: id,
        regionName: name,
        tripCount: 0,
        totalCapacity: 0,
        available: 0,
        upTrips: 0,
        upAvailable: 0,
        downTrips: 0,
        downAvailable: 0,
        waitingTeams: 0,
        waitingPeople: 0,
      };
      byRegion.set(id, acc);
    }
    return acc;
  };

  for (const t of trips ?? []) {
    const supply = one(t.supply);
    if (!supply) continue;
    const acc = ensure(supply.id, supply.name);

    const openSeats = (t.seat_offers ?? [])
      .filter((o) => o.status === "open")
      .reduce((s, o) => s + o.seat_count, 0);
    const active = (t.matches ?? []).filter((m) =>
      ACTIVE_MATCH.includes(m.status ?? ""),
    ).length;
    // 잔여석 = 공개 좌석 슬라이스 합 − 활성 매칭 수 (음수 방지).
    const avail = Math.max(0, openSeats - active);

    acc.tripCount += 1;
    acc.totalCapacity += t.capacity;
    acc.available += avail;
    if (t.direction === "up") {
      acc.upTrips += 1;
      acc.upAvailable += avail;
    } else if (t.direction === "down") {
      acc.downTrips += 1;
      acc.downAvailable += avail;
    }
  }

  // 수요 집계: 대기 신청은 공급 차량이 없는 지구에도 있을 수 있으나,
  // region_id는 신청 "주체 지구"이고 차량 공급 지구와 다를 수 있다.
  // 공개 화면은 "지구별 현황"을 보여주는 게 목적이므로 같은 지구 버킷에 누적한다.
  // 지구명을 모르는(공급 trip이 없는) region_id는 별도 조회로 채운다.
  const waitingByRegion = new Map<string, { teams: number; people: number }>();
  const unknownRegionIds = new Set<string>();
  for (const r of queued ?? []) {
    const cur = waitingByRegion.get(r.region_id) ?? { teams: 0, people: 0 };
    waitingByRegion.set(r.region_id, {
      teams: cur.teams + 1,
      people: cur.people + (r.seat_count ?? 0),
    });
    if (!byRegion.has(r.region_id)) unknownRegionIds.add(r.region_id);
  }

  if (unknownRegionIds.size > 0) {
    const { data: extraRegions } = await db
      .from("regions")
      .select("id, name")
      .in("id", [...unknownRegionIds]);
    for (const reg of extraRegions ?? []) ensure(reg.id, reg.name);
  }

  for (const [regionId, w] of waitingByRegion) {
    const acc = byRegion.get(regionId);
    if (!acc) continue; // 지구명 조회 실패 시 노출하지 않음(잘못된 라벨 방지)
    acc.waitingTeams = w.teams;
    acc.waitingPeople = w.people;
  }

  // 잔여석 많은 순 → 동률이면 지구명 가나다순.
  return [...byRegion.values()].sort(
    (a, b) =>
      b.available - a.available || a.regionName.localeCompare(b.regionName, "ko"),
  );
}

export default async function StatusPage() {
  const regions = await loadStatus();

  const totals = regions.reduce(
    (t, r) => ({
      tripCount: t.tripCount + r.tripCount,
      available: t.available + r.available,
      capacity: t.capacity + r.totalCapacity,
      waitingPeople: t.waitingPeople + r.waitingPeople,
    }),
    { tripCount: 0, available: 0, capacity: 0, waitingPeople: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-10">
      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
            ● 실시간 공개 현황
          </span>
          <span className="text-muted-foreground text-xs">로그인 불필요</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          전국 지구별 잔여석 현황
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          CCC 전국 여름 수련회 — 각 공급 지구가 공개한 차량의 잔여석과 대기 신청
          현황을 실시간으로 요약합니다. 숫자(차량 수·정원·잔여석·대기 인원)만
          보여주며, 학생·간사 등 개인정보는 일절 표시하지 않습니다.
        </p>
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs leading-relaxed">
          좌석 신청·예약 상세 확인은{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            간사 로그인
          </Link>{" "}
          또는{" "}
          <Link href="/r" className="text-primary font-medium hover:underline">
            예약번호 조회
          </Link>
          가 필요합니다.
        </p>
      </header>

      {/* 전국 합계 요약 — 숫자만 */}
      <section
        aria-label="전국 합계"
        className="bg-card mb-6 grid grid-cols-3 gap-2 rounded-xl border p-4 shadow-sm"
      >
        {[
          { label: "공개 차량", value: `${totals.tripCount}대` },
          { label: "전국 잔여석", value: `${totals.available}석` },
          { label: "대기 인원", value: `${totals.waitingPeople}명` },
        ].map((c) => (
          <div key={c.label} className="text-center">
            <p className="text-xl font-bold tabular-nums sm:text-2xl">{c.value}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{c.label}</p>
          </div>
        ))}
      </section>

      <StatusView regions={regions} />

      <footer className="text-muted-foreground mt-10 text-center text-xs">
        CCC IT 사역부 · 2026 여름 수련회 · 본 페이지는 개인정보를 포함하지 않습니다.
      </footer>
    </main>
  );
}
