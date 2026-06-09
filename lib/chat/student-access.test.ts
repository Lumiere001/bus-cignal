import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// getStudentChatAccess의 3단 조회를 모킹 — 데이터셋 + **호출 파라미터/순서까지 캡처**해
// paid 매칭만 입장 허용하는지 + 올바른 컬럼(student_id/trip_id/status='paid'/match_id)으로
// 필터하는지 검증한다(컬럼 뒤바뀜·가드 누락 회귀 방지).
//   seat_requests: select("id").eq(student_id).eq(trip_id)                          → reqRows
//   matches:       select("id").eq(trip_id).in(request_id).eq(status='paid').limit  → paidRows
//   match_passengers: select("id, name").eq(match_id).limit                          → mpRows
let reqRows: Array<{ id: string }> = [];
let paidRows: Array<{ id: string }> = [];
let mpRows: Array<{ id: string; name: string }> = [];
let calls: {
  seatEq: Array<[string, unknown]>;
  matchEq: Array<[string, unknown]>;
  matchIn: Array<[string, unknown]>;
  mpEq: Array<[string, unknown]>;
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "seat_requests") {
        return {
          select: () => ({
            eq: (c: string, v: unknown) => {
              calls.seatEq.push([c, v]);
              return {
                eq: (c2: string, v2: unknown) => {
                  calls.seatEq.push([c2, v2]);
                  return Promise.resolve({ data: reqRows });
                },
              };
            },
          }),
        };
      }
      if (table === "matches") {
        return {
          select: () => ({
            eq: (c: string, v: unknown) => {
              calls.matchEq.push([c, v]);
              return {
                in: (c2: string, v2: unknown) => {
                  calls.matchIn.push([c2, v2]);
                  return {
                    eq: (c3: string, v3: unknown) => {
                      calls.matchEq.push([c3, v3]);
                      return { limit: () => Promise.resolve({ data: paidRows }) };
                    },
                  };
                },
              };
            },
          }),
        };
      }
      if (table === "match_passengers") {
        return {
          select: () => ({
            eq: (c: string, v: unknown) => {
              calls.mpEq.push([c, v]);
              return { limit: () => Promise.resolve({ data: mpRows }) };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { getStudentChatAccess } from "./access";

beforeEach(() => {
  reqRows = [];
  paidRows = [];
  mpRows = [];
  calls = { seatEq: [], matchEq: [], matchIn: [], mpEq: [] };
});

describe("getStudentChatAccess", () => {
  it("paid 매칭 + 검증 레코드 → passenger access (subjectId=match_passengers.id)", async () => {
    reqRows = [{ id: "req1" }];
    paidRows = [{ id: "m1" }];
    mpRows = [{ id: "mp1", name: "최학생" }];

    const r = await getStudentChatAccess("stu1", "trip-1");
    expect(r).toEqual({
      role: "passenger",
      tripId: "trip-1",
      subjectId: "mp1",
      displayName: "최학생",
    });

    // 올바른 컬럼·값으로 필터했는지 — 컬럼 뒤바뀜/가드 누락 회귀 방지
    expect(calls.seatEq).toContainEqual(["student_id", "stu1"]);
    expect(calls.seatEq).toContainEqual(["trip_id", "trip-1"]);
    expect(calls.matchEq).toContainEqual(["trip_id", "trip-1"]);
    expect(calls.matchEq).toContainEqual(["status", "paid"]); // paid-only 게이트
    expect(calls.matchIn).toContainEqual(["request_id", ["req1"]]);
    expect(calls.mpEq).toContainEqual(["match_id", "m1"]);
  });

  it("이 trip 신청 없음 → null (이후 조회 안 함)", async () => {
    reqRows = [];
    expect(await getStudentChatAccess("stu1", "trip-1")).toBeNull();
    // 신청이 없으면 매칭/검증 레코드 조회로 진행하지 않음
    expect(calls.matchEq).toHaveLength(0);
    expect(calls.mpEq).toHaveLength(0);
  });

  it("paid 매칭 없음(미입금/취소) → null", async () => {
    reqRows = [{ id: "req1" }];
    paidRows = [];
    expect(await getStudentChatAccess("stu1", "trip-1")).toBeNull();
    expect(calls.mpEq).toHaveLength(0); // paid 없으면 검증 레코드 조회 안 함
  });

  it("검증 레코드(match_passengers) 없음 → null", async () => {
    reqRows = [{ id: "req1" }];
    paidRows = [{ id: "m1" }];
    mpRows = [];
    expect(await getStudentChatAccess("stu1", "trip-1")).toBeNull();
  });
});
