import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only는 클라이언트 번들에서만 throw — 테스트(node)에서는 빈 모듈로 대체
vi.mock("server-only", () => ({}));

// 관리자 클라이언트 mock — insert 호출 캡처
const insert = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn(() => ({ insert }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

import { emit } from "./index";

type Row = {
  operator_id: string | null;
  passenger_id: string | null;
  type: string;
  channel: string;
  delivery_status: string;
};

function rows(): Row[] {
  return insert.mock.calls[0]?.[0] as Row[];
}

describe("emit (알림 엔진)", () => {
  beforeEach(() => {
    insert.mockClear();
    from.mockClear();
  });

  it("request_new → 공급 간사 인앱+푸시 2 row", async () => {
    await emit(
      "request_new",
      { supplyOperatorId: "op-supply" },
      { requestId: "r1", tripId: "t1", seatCount: 3 },
    );
    expect(from).toHaveBeenCalledWith("notifications");
    expect(rows()).toHaveLength(2);
    expect(rows()[0]).toMatchObject({
      operator_id: "op-supply",
      type: "request_new",
      channel: "in_app",
      delivery_status: "sent",
    });
    expect(rows()[1]).toMatchObject({
      operator_id: "op-supply",
      channel: "push",
      delivery_status: "pending",
    });
  });

  it("depart_d1 → 양쪽 간사 + 학생 = 3대상 × (인앱+푸시) = 6 row", async () => {
    await emit(
      "depart_d1",
      { supplyOperatorId: "s", requestOperatorId: "r", passengerId: "p" },
      { tripId: "t1", departureAt: "2026-08-01T07:00:00+09:00" },
    );
    expect(rows()).toHaveLength(6);
    expect(
      rows().some((x) => x.passenger_id === "p" && x.channel === "in_app"),
    ).toBe(true);
  });

  it("rejection_occurred → 마스터(둘 다 null), 인앱만(푸시 없음)", async () => {
    await emit(
      "rejection_occurred",
      { master: true },
      { requestId: "r1", reason: "정원 초과" },
    );
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({
      operator_id: null,
      passenger_id: null,
      channel: "in_app",
    });
  });

  it("opts.push=false → 인앱만 (chat_message OFF)", async () => {
    await emit(
      "chat_message",
      { supplyOperatorId: "s", requestOperatorId: "r", passengerId: "p" },
      { tripId: "t1" },
      { push: false },
    );
    expect(rows()).toHaveLength(3);
    expect(rows().every((x) => x.channel === "in_app")).toBe(true);
  });

  it("대상이 0이면 insert 호출 안 함 (양쪽 간사 모두 null)", async () => {
    await emit(
      "payment_delay",
      { supplyOperatorId: null, requestOperatorId: null },
      { matchId: "m1" },
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("reapply_recommended → 신청 지구 여럿 fanout + 중복 제거", async () => {
    await emit(
      "reapply_recommended",
      { requestOperatorIds: ["a", "b", "a"] },
      { tripId: "t1" },
    );
    const inApp = rows()
      .filter((x) => x.channel === "in_app")
      .map((x) => x.operator_id)
      .sort();
    expect(inApp).toEqual(["a", "b"]);
  });
});
