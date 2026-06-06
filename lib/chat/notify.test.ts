import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only는 클라이언트 번들에서만 throw — 테스트(node)에서는 빈 모듈로 대체
vi.mock("server-only", () => ({}));

// ── DB mock — 테이블별 마지막 쿼리 결과를 주입 ──────────────────────────
// trips: select("created_by").eq("id").maybeSingle()
const tripSingle = vi.fn();
// seat_requests: select("operator_id").eq("trip_id").in("status") → resolves
const seatRequestsIn = vi.fn();
// matches: select("id").eq("trip_id").eq("status") → resolves
const matchesStatusEq = vi.fn();
// match_passengers: select("id").in("match_id") → resolves
const matchPassengersIn = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "trips") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: tripSingle }) }),
        };
      }
      if (table === "seat_requests") {
        return {
          select: () => ({ eq: () => ({ in: seatRequestsIn }) }),
        };
      }
      if (table === "matches") {
        return {
          select: () => ({ eq: () => ({ eq: matchesStatusEq }) }),
        };
      }
      if (table === "match_passengers") {
        return {
          select: () => ({ in: matchPassengersIn }),
        };
      }
      return {};
    },
  }),
}));

// emit mock — fan-out 호출 캡처
const emit = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications", () => ({
  emit: (...args: unknown[]) => emit(...args),
}));

import {
  resolveChatRecipients,
  notifyChatRecipients,
  notifyChatMessage,
  type ChatRecipient,
} from "./notify";

const TRIP_ID = "trip-1";

/** 기본 시나리오: 공급 간사 op-supply, 신청 간사 op-a/op-b, 학생 mp-1/mp-2. */
function seedHappyPath() {
  tripSingle.mockResolvedValue({ data: { created_by: "op-supply" } });
  seatRequestsIn.mockResolvedValue({
    data: [
      { operator_id: "op-a" },
      { operator_id: "op-b" },
      { operator_id: "op-a" }, // 중복
    ],
  });
  matchesStatusEq.mockResolvedValue({ data: [{ id: "m-1" }, { id: "m-2" }] });
  matchPassengersIn.mockResolvedValue({
    data: [{ id: "mp-1" }, { id: "mp-2" }],
  });
}

describe("resolveChatRecipients", () => {
  beforeEach(() => {
    tripSingle.mockReset();
    seatRequestsIn.mockReset();
    matchesStatusEq.mockReset();
    matchPassengersIn.mockReset();
    seedHappyPath();
  });

  it("공급 간사 + 신청 간사(중복 제거) + 학생 전부 해석", async () => {
    const recipients = await resolveChatRecipients(TRIP_ID, {
      role: "operator",
      subjectId: "outsider", // 참여자 아님 → 아무도 제외 안 됨
    });

    expect(recipients).toContainEqual({
      kind: "supplyOperator",
      operatorId: "op-supply",
    });
    expect(recipients).toContainEqual({
      kind: "requestOperator",
      operatorId: "op-a",
    });
    expect(recipients).toContainEqual({
      kind: "requestOperator",
      operatorId: "op-b",
    });
    expect(recipients).toContainEqual({ kind: "passenger", passengerId: "mp-1" });
    expect(recipients).toContainEqual({ kind: "passenger", passengerId: "mp-2" });

    // op-a 중복 신청은 한 번만
    const opACount = recipients.filter(
      (r) => r.kind === "requestOperator" && r.operatorId === "op-a",
    ).length;
    expect(opACount).toBe(1);
    expect(recipients).toHaveLength(5);
  });

  it("보낸 사람이 공급 간사 → 공급 간사 제외", async () => {
    const recipients = await resolveChatRecipients(TRIP_ID, {
      role: "operator",
      subjectId: "op-supply",
    });
    expect(
      recipients.some((r) => r.kind === "supplyOperator"),
    ).toBe(false);
    expect(recipients).toHaveLength(4);
  });

  it("보낸 사람이 신청 간사 → 본인만 제외, 나머지 신청 간사 유지", async () => {
    const recipients = await resolveChatRecipients(TRIP_ID, {
      role: "operator",
      subjectId: "op-a",
    });
    expect(
      recipients.some(
        (r) => r.kind === "requestOperator" && r.operatorId === "op-a",
      ),
    ).toBe(false);
    expect(recipients).toContainEqual({
      kind: "requestOperator",
      operatorId: "op-b",
    });
    expect(recipients).toContainEqual({
      kind: "supplyOperator",
      operatorId: "op-supply",
    });
  });

  it("보낸 사람이 학생 → 본인 학생만 제외", async () => {
    const recipients = await resolveChatRecipients(TRIP_ID, {
      role: "passenger",
      subjectId: "mp-1",
    });
    expect(
      recipients.some((r) => r.kind === "passenger" && r.passengerId === "mp-1"),
    ).toBe(false);
    expect(recipients).toContainEqual({ kind: "passenger", passengerId: "mp-2" });
    // 간사들은 학생이 보내도 그대로 받음
    expect(
      recipients.some((r) => r.kind === "supplyOperator"),
    ).toBe(true);
  });

  it("신청 간사가 공급 간사와 동일 id면 한 번만 (중복 슬롯 방지)", async () => {
    seatRequestsIn.mockResolvedValue({
      data: [{ operator_id: "op-supply" }, { operator_id: "op-b" }],
    });
    const recipients = await resolveChatRecipients(TRIP_ID, {
      role: "passenger",
      subjectId: "mp-1",
    });
    const supplyHits = recipients.filter(
      (r) =>
        (r.kind === "supplyOperator" && r.operatorId === "op-supply") ||
        (r.kind === "requestOperator" && r.operatorId === "op-supply"),
    );
    expect(supplyHits).toHaveLength(1);
  });

  it("paid 매칭이 없으면 학생 수신자 없음 (match_passengers 미조회)", async () => {
    matchesStatusEq.mockResolvedValue({ data: [] });
    const recipients = await resolveChatRecipients(TRIP_ID, {
      role: "operator",
      subjectId: "outsider",
    });
    expect(recipients.some((r) => r.kind === "passenger")).toBe(false);
    expect(matchPassengersIn).not.toHaveBeenCalled();
  });

  it("created_by null이면 공급 간사 없음", async () => {
    tripSingle.mockResolvedValue({ data: { created_by: null } });
    const recipients = await resolveChatRecipients(TRIP_ID, {
      role: "operator",
      subjectId: "outsider",
    });
    expect(recipients.some((r) => r.kind === "supplyOperator")).toBe(false);
  });
});

describe("notifyChatRecipients (emit fan-out)", () => {
  beforeEach(() => {
    emit.mockReset();
    emit.mockResolvedValue(undefined);
  });

  const recipients: ChatRecipient[] = [
    { kind: "supplyOperator", operatorId: "op-supply" },
    { kind: "requestOperator", operatorId: "op-a" },
    { kind: "passenger", passengerId: "mp-2" },
  ];

  it("수신자마다 chat_message 한 번씩, 슬롯 하나만 채움(나머지 null)", async () => {
    await notifyChatRecipients(TRIP_ID, recipients);

    expect(emit).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledWith(
      "chat_message",
      { supplyOperatorId: "op-supply", requestOperatorId: null, passengerId: null },
      { tripId: TRIP_ID },
    );
    expect(emit).toHaveBeenCalledWith(
      "chat_message",
      { supplyOperatorId: null, requestOperatorId: "op-a", passengerId: null },
      { tripId: TRIP_ID },
    );
    expect(emit).toHaveBeenCalledWith(
      "chat_message",
      { supplyOperatorId: null, requestOperatorId: null, passengerId: "mp-2" },
      { tripId: TRIP_ID },
    );
  });

  it("emit 한 건 실패해도 나머지 fan-out은 계속 (best-effort)", async () => {
    emit
      .mockRejectedValueOnce(new Error("FCM down")) // 첫 수신자 실패
      .mockResolvedValue(undefined);

    await expect(
      notifyChatRecipients(TRIP_ID, recipients),
    ).resolves.toBeUndefined();

    // 실패해도 3건 모두 시도
    expect(emit).toHaveBeenCalledTimes(3);
  });

  it("수신자 0이면 emit 호출 안 함", async () => {
    await notifyChatRecipients(TRIP_ID, []);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("notifyChatMessage (해석 + fan-out 통합)", () => {
  beforeEach(() => {
    tripSingle.mockReset();
    seatRequestsIn.mockReset();
    matchesStatusEq.mockReset();
    matchPassengersIn.mockReset();
    emit.mockReset();
    emit.mockResolvedValue(undefined);
    seedHappyPath();
  });

  it("보낸 사람 제외 후 남은 수신자 수만큼 emit", async () => {
    // 학생 mp-1이 보냄 → 본인(mp-1) 제외 = 공급 + op-a + op-b + mp-2 = 4
    await notifyChatMessage(TRIP_ID, { role: "passenger", subjectId: "mp-1" });
    expect(emit).toHaveBeenCalledTimes(4);
  });
});
