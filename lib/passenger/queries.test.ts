import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// match_passengers 첫 번째 호출 (hash 검증용 단건 조회) 터미널 mock
const mpHashSingle = vi.fn();

// match_passengers 두 번째 호출 (name+phone 다중 조회)
// .eq("phone",...) → mpMultiEq1 / .eq("name",...) → mpMultiEq2 로 인자 캡처
const mpMultiEq1 = vi.fn();
const mpMultiEq2 = vi.fn();

// 나머지 테이블 터미널 mock
const matchesIn = vi.fn();
const tripsIn = vi.fn();
const locsIn = vi.fn();

// match_passengers 호출 순서 구분용 카운터
let mpFromIdx = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "match_passengers") {
        mpFromIdx++;
        if (mpFromIdx === 1) {
          // 1st: .select("name,phone,access_token_hash").eq("id",...).maybeSingle()
          return { select: () => ({ eq: () => ({ maybeSingle: mpHashSingle }) }) };
        }
        // 2nd: .select("match_id").eq("phone",...).eq("name",...)
        return { select: () => ({ eq: mpMultiEq1 }) };
      }
      if (table === "matches")
        return { select: () => ({ in: () => matchesIn() }) };
      if (table === "trips")
        return { select: () => ({ in: () => tripsIn() }) };
      if (table === "region_locations")
        return { select: () => ({ in: () => locsIn() }) };
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
    },
  }),
}));

import { getMatchesForPassenger } from "./queries";

function hashOf(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

const SESSION_TOKEN = "test-session-token-abc123";
const SESSION_HASH = hashOf(SESSION_TOKEN);

const BASE_MP_ROW = {
  name: "이지은",
  phone: "010-3333-4444",
  access_token_hash: SESSION_HASH,
};

const BASE_MATCH = {
  id: "m-1",
  reservation_code: "BUS-7K9M",
  status: "paid",
  trip_id: "t-1",
};

const BASE_TRIP = {
  id: "t-1",
  departure_at: "2026-08-01T07:00:00Z",
  price_per_seat: 35000,
  direction: "to",
  origin_location_id: "loc-1",
  destination_location_id: "loc-2",
};

const BASE_LOCS = [
  { id: "loc-1", address: "서울역", label: "서울역" },
  { id: "loc-2", address: "광주역", label: "광주역" },
];

describe("getMatchesForPassenger", () => {
  beforeEach(() => {
    mpFromIdx = 0;
    mpHashSingle.mockResolvedValue({ data: BASE_MP_ROW });
    mpMultiEq1.mockReturnValue({ eq: mpMultiEq2 });
    mpMultiEq2.mockResolvedValue({ data: [{ match_id: "m-1" }] });
    matchesIn.mockClear();
    matchesIn.mockResolvedValue({ data: [BASE_MATCH] });
    tripsIn.mockClear();
    tripsIn.mockResolvedValue({ data: [BASE_TRIP] });
    locsIn.mockClear();
    locsIn.mockResolvedValue({ data: BASE_LOCS });
  });

  it("access_token_hash가 null이면 빈 배열 반환 + matches/trips 조회 미진행", async () => {
    mpHashSingle.mockResolvedValue({
      data: { ...BASE_MP_ROW, access_token_hash: null },
    });
    const result = await getMatchesForPassenger("mp-1", SESSION_TOKEN);
    expect(result).toEqual([]);
    // hash 검증 실패 시 개인정보가 포함된 하위 쿼리로 진행하지 않음
    expect(matchesIn).not.toHaveBeenCalled();
    expect(tripsIn).not.toHaveBeenCalled();
    expect(locsIn).not.toHaveBeenCalled();
  });

  it("sessionToken 해시 불일치 → 빈 배열 + matches/trips 조회 미진행 (구 세션 자동 무효화)", async () => {
    // 새 로그인으로 DB hash가 교체된 후 기존 JWT 사용 시나리오
    const result = await getMatchesForPassenger("mp-1", "stale-old-token");
    expect(result).toEqual([]);
    // hash 불일치 시 매칭 데이터 조회로 진행하지 않음 (타인 데이터 노출 방지)
    expect(matchesIn).not.toHaveBeenCalled();
    expect(tripsIn).not.toHaveBeenCalled();
    expect(locsIn).not.toHaveBeenCalled();
  });

  it("match_passengers 행 없음 → 빈 배열 + matches/trips 조회 미진행", async () => {
    mpHashSingle.mockResolvedValue({ data: null });
    const result = await getMatchesForPassenger("mp-1", SESSION_TOKEN);
    expect(result).toEqual([]);
    expect(matchesIn).not.toHaveBeenCalled();
    expect(tripsIn).not.toHaveBeenCalled();
    expect(locsIn).not.toHaveBeenCalled();
  });

  it("여러 매칭을 출발 시각 가까운 순(오름차순)으로 정렬", async () => {
    mpMultiEq2.mockResolvedValue({
      data: [{ match_id: "m-1" }, { match_id: "m-2" }],
    });
    matchesIn.mockResolvedValue({
      data: [
        { id: "m-1", reservation_code: "BUS-LATE", status: "paid", trip_id: "t-1" },
        { id: "m-2", reservation_code: "BUS-EARLY", status: "awaiting_payment", trip_id: "t-2" },
      ],
    });
    tripsIn.mockResolvedValue({
      data: [
        { ...BASE_TRIP, id: "t-1", departure_at: "2026-08-10T07:00:00Z" },
        { ...BASE_TRIP, id: "t-2", departure_at: "2026-08-01T07:00:00Z" },
      ],
    });

    const result = await getMatchesForPassenger("mp-1", SESSION_TOKEN);

    expect(result).toHaveLength(2);
    expect(result[0].reservationCode).toBe("BUS-EARLY"); // 출발 빠름
    expect(result[1].reservationCode).toBe("BUS-LATE");  // 출발 늦음
  });

  it("DB 조회 시 name+phone 튜플을 필터로 전달 (phone 단독 조회 방지)", async () => {
    await getMatchesForPassenger("mp-1", SESSION_TOKEN);

    // phone 조회: mpMultiEq1("phone", <phone>)
    expect(mpMultiEq1).toHaveBeenCalledWith("phone", "010-3333-4444");
    // name 조회: mpMultiEq2("name", <name>)
    expect(mpMultiEq2).toHaveBeenCalledWith("name", "이지은");
  });

  it("(V1 정책) 동일 name+phone은 같은 학생으로 묶어 복수 매칭 반환", async () => {
    // 같은 이름·전화로 등록된 복수 match_passengers 행 → 모두 대시보드에 표시
    // V2에서 학생 identity DB 연동 시 이 정책은 교체됨
    mpMultiEq2.mockResolvedValue({
      data: [{ match_id: "m-1" }, { match_id: "m-2" }],
    });
    matchesIn.mockResolvedValue({
      data: [
        { id: "m-1", reservation_code: "BUS-A", status: "paid", trip_id: "t-1" },
        { id: "m-2", reservation_code: "BUS-B", status: "awaiting_payment", trip_id: "t-1" },
      ],
    });

    const result = await getMatchesForPassenger("mp-1", SESSION_TOKEN);
    expect(result).toHaveLength(2);
  });
});
