import { describe, it, expect } from "vitest";
import { buildSettlementMatrix } from "./index";
import type { SettlementMatch, SettlementMatchStatus } from "./types";

const GWANGJU = "region-gwangju";
const BUSAN = "region-busan";
const DAEGU = "region-daegu";

const NAMES: Record<string, string> = {
  [GWANGJU]: "광주지구",
  [BUSAN]: "부산지구",
  [DAEGU]: "대구지구",
};

let seq = 0;
function match(
  supplyRegionId: string,
  requestRegionId: string,
  status: SettlementMatchStatus,
  pricePerSeat = 35000,
): SettlementMatch {
  seq += 1;
  return {
    matchId: `m${seq}`,
    status,
    pricePerSeat,
    supplyRegionId,
    supplyRegionName: NAMES[supplyRegionId] ?? supplyRegionId,
    requestRegionId,
    requestRegionName: NAMES[requestRegionId] ?? requestRegionId,
  };
}

describe("buildSettlementMatrix()", () => {
  it("빈 매칭 → 빈 매트릭스 + 0 합계", () => {
    const m = buildSettlementMatrix([]);
    expect(m.regions).toEqual([]);
    expect(m.cells).toEqual([]);
    expect(m.grandConfirmedAmount).toBe(0);
    expect(m.grandPendingAmount).toBe(0);
  });

  it("paid 1건 → 확정 칸 + 공급·신청 지구 합집합", () => {
    const m = buildSettlementMatrix([match(GWANGJU, BUSAN, "paid")]);
    expect(m.regions.map((r) => r.id).sort()).toEqual([BUSAN, GWANGJU].sort());
    expect(m.cells).toHaveLength(1);
    expect(m.cells[0]).toMatchObject({
      supplyRegionId: GWANGJU,
      requestRegionId: BUSAN,
      confirmedCount: 1,
      confirmedAmount: 35000,
      pendingCount: 0,
      pendingAmount: 0,
    });
    expect(m.grandConfirmedAmount).toBe(35000);
  });

  it("awaiting_payment·payment_reported → 진행중 칸", () => {
    const m = buildSettlementMatrix([
      match(GWANGJU, BUSAN, "awaiting_payment"),
      match(GWANGJU, BUSAN, "payment_reported"),
    ]);
    expect(m.cells).toHaveLength(1);
    expect(m.cells[0]).toMatchObject({ pendingCount: 2, pendingAmount: 70000, confirmedCount: 0 });
    expect(m.grandPendingAmount).toBe(70000);
    expect(m.grandConfirmedAmount).toBe(0);
  });

  it("expired·cancelled → 집계 제외", () => {
    const m = buildSettlementMatrix([
      match(GWANGJU, BUSAN, "expired"),
      match(GWANGJU, BUSAN, "cancelled"),
    ]);
    expect(m.cells).toEqual([]);
    expect(m.regions).toEqual([]);
  });

  it("같은 (공급,신청) 쌍은 한 칸에 누적, 다른 쌍은 별도 칸", () => {
    const m = buildSettlementMatrix([
      match(GWANGJU, BUSAN, "paid"),
      match(GWANGJU, BUSAN, "awaiting_payment"),
      match(BUSAN, GWANGJU, "paid"),
    ]);
    expect(m.cells).toHaveLength(2);
    const gwToBs = m.cells.find((c) => c.supplyRegionId === GWANGJU && c.requestRegionId === BUSAN);
    expect(gwToBs).toMatchObject({ confirmedCount: 1, confirmedAmount: 35000, pendingCount: 1, pendingAmount: 35000 });
    const bsToGw = m.cells.find((c) => c.supplyRegionId === BUSAN && c.requestRegionId === GWANGJU);
    expect(bsToGw).toMatchObject({ confirmedCount: 1, confirmedAmount: 35000 });
  });

  it("regions는 이름 가나다순 정렬", () => {
    const m = buildSettlementMatrix([
      match(GWANGJU, BUSAN, "paid"),
      match(DAEGU, GWANGJU, "paid"),
    ]);
    // 광주지구 · 대구지구 · 부산지구
    expect(m.regions.map((r) => r.name)).toEqual(["광주지구", "대구지구", "부산지구"]);
  });
});
