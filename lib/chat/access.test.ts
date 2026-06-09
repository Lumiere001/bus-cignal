import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// match_passengers: select("name, phone")→eq(id)→maybeSingle
const mpNamePhone = vi.fn();
// match_passengers: select("match_id")→eq(phone)→eq(name) → returns {data}
const mpMatchIds = vi.fn();
// matches(passenger): select("id")→in(id)→eq(trip_id)→eq(status)→maybeSingle
// status 필터를 실제로 적용하는 데이터셋 기반 mock (cancelled/expired가 paid 조회에서 제외되는지 진짜 검증)
let passengerMatchDataset: Array<{
  id: string;
  trip_id: string;
  status: string;
}> = [];
// trips: select→eq→maybeSingle
const tripSingle = vi.fn();
// seat_requests: select("id")→eq(trip_id)→eq(region_id) → {data}
const seatReqRows = vi.fn();
// matches: select("id")→eq(trip_id)→in(request_id)→maybeSingle (operator request region)
const operatorMatch = vi.fn();
// operators: select("name")→eq(id)→maybeSingle
const operatorName = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "match_passengers") {
        return {
          select: (cols: string) => {
            if (cols === "name, phone") {
              return { eq: () => ({ maybeSingle: mpNamePhone }) };
            }
            // select("match_id"): .eq(phone).eq(name)
            return { eq: () => ({ eq: mpMatchIds }) };
          },
        };
      }
      if (table === "matches") {
        return {
          select: () => ({
            // passenger: .in("id", ids).eq("trip_id", t).eq("status", s).maybeSingle()
            // 인자를 실제로 받아 데이터셋을 필터 → status='paid'만 통과시키는지 검증 가능
            in: (_idCol: string, ids: string[]) => ({
              eq: (_c1: string, tripId: string) => ({
                eq: (_c2: string, status: string) => ({
                  maybeSingle: async () => {
                    const row = passengerMatchDataset.find(
                      (m) =>
                        ids.includes(m.id) &&
                        m.trip_id === tripId &&
                        m.status === status,
                    );
                    return { data: row ? { id: row.id } : null };
                  },
                }),
              }),
            }),
            // operator: .eq(trip_id).in(request_id).maybeSingle
            eq: () => ({ in: () => ({ maybeSingle: operatorMatch }) }),
          }),
        };
      }
      if (table === "trips") {
        return { select: () => ({ eq: () => ({ maybeSingle: tripSingle }) }) };
      }
      if (table === "seat_requests") {
        return { select: () => ({ eq: () => ({ eq: seatReqRows }) }) };
      }
      if (table === "operators") {
        return { select: () => ({ eq: () => ({ maybeSingle: operatorName }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

// 세션 모킹 (resolveChatAccess 용)
const getPassengerSession = vi.fn();
const getOperatorSession = vi.fn();
const getStudentSession = vi.fn();
vi.mock("@/lib/auth/passenger", () => ({
  getPassengerSession: () => getPassengerSession(),
}));
vi.mock("@/lib/auth/operator", () => ({
  getOperatorSession: () => getOperatorSession(),
}));
vi.mock("@/lib/auth/student", () => ({
  getStudentSession: () => getStudentSession(),
}));

import {
  getOperatorChatAccess,
  getPassengerChatAccess,
  resolveChatAccess,
} from "./access";

beforeEach(() => {
  vi.clearAllMocks();
  passengerMatchDataset = [];
  // 학생 세션은 기본 없음 — resolveChatAccess의 학생 분기를 건드리지 않음(passenger/operator 경로 검증 유지).
  getStudentSession.mockResolvedValue(null);
});

describe("getPassengerChatAccess", () => {
  it("paid 매칭 보유 → access 반환", async () => {
    mpNamePhone.mockResolvedValue({ data: { name: "홍길동", phone: "01012345678" } });
    mpMatchIds.mockResolvedValue({ data: [{ match_id: "m1" }] });
    passengerMatchDataset = [{ id: "m1", trip_id: "trip-1", status: "paid" }];

    const r = await getPassengerChatAccess("p1", "trip-1");
    expect(r).toEqual({
      role: "passenger",
      tripId: "trip-1",
      subjectId: "p1",
      displayName: "홍길동",
    });
  });

  it("passengerId 없음 → null", async () => {
    mpNamePhone.mockResolvedValue({ data: null });
    expect(await getPassengerChatAccess("p1", "trip-1")).toBeNull();
  });

  it("paid 매칭 없음(awaiting_payment) → null", async () => {
    mpNamePhone.mockResolvedValue({ data: { name: "홍길동", phone: "010" } });
    mpMatchIds.mockResolvedValue({ data: [{ match_id: "m1" }] });
    passengerMatchDataset = [
      { id: "m1", trip_id: "trip-1", status: "awaiting_payment" },
    ];

    expect(await getPassengerChatAccess("p1", "trip-1")).toBeNull();
  });

  // ★ 회귀: 취소된 매칭만 가진 학생은 채팅 입장 불가 (status='paid' 필터가 cancelled 제외)
  it("cancelled 매칭만 보유 → null (취소 후 채팅 진입 차단)", async () => {
    mpNamePhone.mockResolvedValue({ data: { name: "이지은", phone: "01033334444" } });
    mpMatchIds.mockResolvedValue({ data: [{ match_id: "m1" }] });
    passengerMatchDataset = [
      { id: "m1", trip_id: "trip-1", status: "cancelled" },
    ];

    expect(await getPassengerChatAccess("p1", "trip-1")).toBeNull();
  });

  it("expired 매칭만 보유 → null", async () => {
    mpNamePhone.mockResolvedValue({ data: { name: "이지은", phone: "01033334444" } });
    mpMatchIds.mockResolvedValue({ data: [{ match_id: "m1" }] });
    passengerMatchDataset = [{ id: "m1", trip_id: "trip-1", status: "expired" }];

    expect(await getPassengerChatAccess("p1", "trip-1")).toBeNull();
  });

  it("같은 trip에 cancelled + 다른 trip paid → 이 trip은 null (trip별 격리)", async () => {
    mpNamePhone.mockResolvedValue({ data: { name: "이지은", phone: "01033334444" } });
    mpMatchIds.mockResolvedValue({
      data: [{ match_id: "m1" }, { match_id: "m2" }],
    });
    passengerMatchDataset = [
      { id: "m1", trip_id: "trip-1", status: "cancelled" }, // 이 trip은 취소됨
      { id: "m2", trip_id: "trip-2", status: "paid" }, // 다른 trip은 paid
    ];

    expect(await getPassengerChatAccess("p1", "trip-1")).toBeNull();
  });

  it("cancelled + 같은 trip 다른 paid 매칭 → access (유효 예약 존재)", async () => {
    // 동일 학생이 같은 trip에 취소된 것과 별개로 유효한 paid 매칭을 가지면 입장 허용
    mpNamePhone.mockResolvedValue({ data: { name: "이지은", phone: "01033334444" } });
    mpMatchIds.mockResolvedValue({
      data: [{ match_id: "m1" }, { match_id: "m2" }],
    });
    passengerMatchDataset = [
      { id: "m1", trip_id: "trip-1", status: "cancelled" },
      { id: "m2", trip_id: "trip-1", status: "paid" },
    ];

    const r = await getPassengerChatAccess("p1", "trip-1");
    expect(r?.role).toBe("passenger");
  });
});

describe("getOperatorChatAccess", () => {
  const op = { operatorId: "op1", cccId: "c1", regionId: "region-A" };

  it("공급 지구(operator_region_id 일치) → access", async () => {
    tripSingle.mockResolvedValue({
      data: { id: "trip-1", operator_region_id: "region-A" },
    });
    operatorName.mockResolvedValue({ data: { name: "김간사" } });

    const r = await getOperatorChatAccess(op, "trip-1");
    expect(r).toEqual({
      role: "operator",
      tripId: "trip-1",
      subjectId: "op1",
      displayName: "김간사",
    });
    // 공급 지구면 seat_requests 조회 불필요
    expect(seatReqRows).not.toHaveBeenCalled();
  });

  it("신청 지구(매칭된 학생 있음) → access", async () => {
    tripSingle.mockResolvedValue({
      data: { id: "trip-1", operator_region_id: "region-OTHER" },
    });
    seatReqRows.mockResolvedValue({ data: [{ id: "req1" }] });
    operatorMatch.mockResolvedValue({ data: { id: "m1" } });
    operatorName.mockResolvedValue({ data: { name: "이간사" } });

    const r = await getOperatorChatAccess(op, "trip-1");
    expect(r?.role).toBe("operator");
    expect(r?.subjectId).toBe("op1");
  });

  it("신청 지구지만 매칭된 학생 없음 → null", async () => {
    tripSingle.mockResolvedValue({
      data: { id: "trip-1", operator_region_id: "region-OTHER" },
    });
    seatReqRows.mockResolvedValue({ data: [{ id: "req1" }] });
    operatorMatch.mockResolvedValue({ data: null });

    expect(await getOperatorChatAccess(op, "trip-1")).toBeNull();
  });

  it("관련 없는 간사(신청도 공급도 아님) → null", async () => {
    tripSingle.mockResolvedValue({
      data: { id: "trip-1", operator_region_id: "region-OTHER" },
    });
    seatReqRows.mockResolvedValue({ data: [] });

    expect(await getOperatorChatAccess(op, "trip-1")).toBeNull();
    expect(operatorMatch).not.toHaveBeenCalled();
  });

  it("regionId 없는 세션 → null (조회 전 차단)", async () => {
    const noRegion = { operatorId: "op1", cccId: "c1", regionId: null };
    expect(await getOperatorChatAccess(noRegion, "trip-1")).toBeNull();
    expect(tripSingle).not.toHaveBeenCalled();
  });

  it("존재하지 않는 trip → null", async () => {
    tripSingle.mockResolvedValue({ data: null });
    expect(await getOperatorChatAccess(op, "trip-1")).toBeNull();
  });
});

describe("resolveChatAccess (세션 기반)", () => {
  it("학생 세션 우선 → paid면 passenger access", async () => {
    getPassengerSession.mockResolvedValue({ passengerId: "p1" });
    mpNamePhone.mockResolvedValue({ data: { name: "홍길동", phone: "010" } });
    mpMatchIds.mockResolvedValue({ data: [{ match_id: "m1" }] });
    passengerMatchDataset = [{ id: "m1", trip_id: "trip-1", status: "paid" }];

    const r = await resolveChatAccess("trip-1");
    expect(r?.role).toBe("passenger");
    expect(getOperatorSession).not.toHaveBeenCalled();
  });

  it("학생 권한 없으면 간사 세션 확인", async () => {
    getPassengerSession.mockResolvedValue({ passengerId: "p1" });
    mpNamePhone.mockResolvedValue({ data: null }); // 학생 권한 없음
    getOperatorSession.mockResolvedValue({
      operatorId: "op1",
      cccId: "c1",
      regionId: "region-A",
    });
    tripSingle.mockResolvedValue({
      data: { id: "trip-1", operator_region_id: "region-A" },
    });
    operatorName.mockResolvedValue({ data: { name: "김간사" } });

    const r = await resolveChatAccess("trip-1");
    expect(r?.role).toBe("operator");
  });

  it("세션 모두 없음 → null", async () => {
    getPassengerSession.mockResolvedValue(null);
    getOperatorSession.mockResolvedValue(null);
    expect(await resolveChatAccess("trip-1")).toBeNull();
  });

  // ★ 사용자 보고 시나리오: 취소된 매칭만 가진 학생(간사 세션 없음)이 /chat/:tripId 직접 접근 → 차단
  it("취소된 매칭만 가진 학생 + 간사 세션 없음 → null (페이지가 '접근 불가' 표시)", async () => {
    getPassengerSession.mockResolvedValue({ passengerId: "p1" });
    mpNamePhone.mockResolvedValue({ data: { name: "이지은", phone: "01033334444" } });
    mpMatchIds.mockResolvedValue({ data: [{ match_id: "m1" }] });
    passengerMatchDataset = [
      { id: "m1", trip_id: "trip-1", status: "cancelled" },
    ];
    getOperatorSession.mockResolvedValue(null);

    expect(await resolveChatAccess("trip-1")).toBeNull();
  });
});
