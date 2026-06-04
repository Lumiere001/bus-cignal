import { describe, it, expect } from "vitest";
import { buildSettlement } from "./index";
import type { SettlementMatch, SettlementMatchStatus } from "./types";

const GWANGJU = "region-gwangju";
const BUSAN = "region-busan";
const DAEGU = "region-daegu";

let seq = 0;
function match(
  partial: Partial<SettlementMatch> & {
    supplyRegionId: string;
    requestRegionId: string;
    status: SettlementMatchStatus;
  },
): SettlementMatch {
  seq += 1;
  const names: Record<string, string> = {
    [GWANGJU]: "광주지구",
    [BUSAN]: "부산지구",
    [DAEGU]: "대구지구",
  };
  return {
    matchId: `m${seq}`,
    pricePerSeat: 35000,
    supplyRegionName: names[partial.supplyRegionId] ?? partial.supplyRegionId,
    requestRegionName: names[partial.requestRegionId] ?? partial.requestRegionId,
    ...partial,
  };
}

describe("buildSettlement()", () => {
  it("빈 매칭 → 빈 ledger + 0 합계", () => {
    const l = buildSettlement(GWANGJU, []);
    expect(l.receivable).toEqual([]);
    expect(l.payable).toEqual([]);
    expect(l.totals).toEqual({
      receivableConfirmed: 0,
      receivablePending: 0,
      payableConfirmed: 0,
      payablePending: 0,
    });
  });

  it("내가 공급(supply)한 paid 매칭 → 받을 돈(확정)", () => {
    const l = buildSettlement(GWANGJU, [
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "paid" }),
    ]);
    expect(l.receivable).toHaveLength(1);
    expect(l.receivable[0]).toMatchObject({
      counterpartRegionId: BUSAN,
      counterpartRegionName: "부산지구",
      confirmedCount: 1,
      confirmedAmount: 35000,
      pendingCount: 0,
      pendingAmount: 0,
    });
    expect(l.payable).toEqual([]);
    expect(l.totals.receivableConfirmed).toBe(35000);
  });

  it("내가 신청(request)한 paid 매칭 → 보낼 돈(확정)", () => {
    const l = buildSettlement(BUSAN, [
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "paid" }),
    ]);
    expect(l.payable).toHaveLength(1);
    expect(l.payable[0]).toMatchObject({
      counterpartRegionId: GWANGJU,
      counterpartRegionName: "광주지구",
      confirmedAmount: 35000,
    });
    expect(l.receivable).toEqual([]);
    expect(l.totals.payableConfirmed).toBe(35000);
  });

  it("awaiting_payment·payment_reported → 진행중(pending), paid와 분리 집계", () => {
    const l = buildSettlement(GWANGJU, [
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "paid" }),
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "awaiting_payment" }),
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "payment_reported" }),
    ]);
    expect(l.receivable).toHaveLength(1);
    expect(l.receivable[0]).toMatchObject({
      confirmedCount: 1,
      confirmedAmount: 35000,
      pendingCount: 2,
      pendingAmount: 70000,
    });
    expect(l.totals).toMatchObject({
      receivableConfirmed: 35000,
      receivablePending: 70000,
    });
  });

  it("expired·cancelled 매칭은 집계에서 제외", () => {
    const l = buildSettlement(GWANGJU, [
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "expired" }),
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "cancelled" }),
    ]);
    expect(l.receivable).toEqual([]);
    expect(l.totals.receivableConfirmed).toBe(0);
    expect(l.totals.receivablePending).toBe(0);
  });

  it("같은 상대 지구의 여러 매칭은 한 행으로 합산", () => {
    const l = buildSettlement(GWANGJU, [
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "paid", pricePerSeat: 35000 }),
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "paid", pricePerSeat: 40000 }),
    ]);
    expect(l.receivable).toHaveLength(1);
    expect(l.receivable[0].confirmedCount).toBe(2);
    expect(l.receivable[0].confirmedAmount).toBe(75000);
  });

  it("여러 상대 지구는 별도 행 + 이름순 정렬", () => {
    const l = buildSettlement(GWANGJU, [
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "paid" }),
      match({ supplyRegionId: GWANGJU, requestRegionId: DAEGU, status: "paid" }),
    ]);
    expect(l.receivable.map((e) => e.counterpartRegionName)).toEqual([
      "대구지구",
      "부산지구",
    ]); // 가나다순 (대 < 부)
  });

  it("받을·보낼 동시 발생 (내 지구가 양쪽 역할)", () => {
    const l = buildSettlement(GWANGJU, [
      match({ supplyRegionId: GWANGJU, requestRegionId: BUSAN, status: "paid" }), // 받을
      match({ supplyRegionId: DAEGU, requestRegionId: GWANGJU, status: "paid" }), // 보낼
    ]);
    expect(l.receivable).toHaveLength(1);
    expect(l.receivable[0].counterpartRegionId).toBe(BUSAN);
    expect(l.payable).toHaveLength(1);
    expect(l.payable[0].counterpartRegionId).toBe(DAEGU);
    expect(l.totals.receivableConfirmed).toBe(35000);
    expect(l.totals.payableConfirmed).toBe(35000);
  });

  it("본인 지구와 무관한 매칭은 무시", () => {
    const l = buildSettlement(GWANGJU, [
      match({ supplyRegionId: BUSAN, requestRegionId: DAEGU, status: "paid" }),
    ]);
    expect(l.receivable).toEqual([]);
    expect(l.payable).toEqual([]);
  });
});
