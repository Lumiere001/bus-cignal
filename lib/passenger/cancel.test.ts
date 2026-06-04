import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// match_passengers: select("name, phone") → eq("id") → maybeSingle
const mpNamePhoneSingle = vi.fn();
// match_passengers: select("id") → eq("name") → eq("phone") → eq("match_id") → maybeSingle
const mpOwnerSingle = vi.fn();
// matches: select → eq → maybeSingle (getMatchForCancel)
const matchGetSingle = vi.fn();
// trips: select → eq → maybeSingle
const tripSingle = vi.fn();
// region_locations: select → in
const locsIn = vi.fn();
// matches: update → eq → in → select
const matchUpdateFn = vi.fn();
const matchUpdateSelectFn = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "match_passengers") {
        return {
          select: (cols: string) => {
            if (cols === "name, phone") {
              return { eq: () => ({ maybeSingle: mpNamePhoneSingle }) };
            }
            // select("id"): 소유권 확인 — .eq(name).eq(phone).eq(match_id)
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({ maybeSingle: mpOwnerSingle }),
                }),
              }),
            };
          },
        };
      }
      if (table === "matches") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: matchGetSingle }) }),
          update: (data: unknown) => {
            matchUpdateFn(data);
            return {
              eq: () => ({
                in: () => ({ select: matchUpdateSelectFn }),
              }),
            };
          },
        };
      }
      if (table === "trips") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: tripSingle }) }),
        };
      }
      if (table === "region_locations") {
        return {
          select: () => ({ in: () => locsIn() }),
        };
      }
      return {};
    },
  }),
}));

import { getMatchForCancel, cancelMatch } from "./cancel";

const BASE_MP_NAME_PHONE = { name: "이지은", phone: "010-3333-4444" };
const BASE_MP_OWNER = { id: "mp-1" };
const BASE_MATCH = {
  id: "m-1",
  status: "awaiting_payment",
  reservation_code: "BUS-7K9M",
  trip_id: "t-1",
};
const BASE_TRIP = {
  departure_at: "2026-08-01T07:00:00Z",
  origin_location_id: "loc-1",
  destination_location_id: "loc-2",
};
const BASE_LOCS = [
  { id: "loc-1", address: "서울역", label: "서울역" },
  { id: "loc-2", address: "광주역", label: "광주역" },
];

describe("getMatchForCancel", () => {
  beforeEach(() => {
    mpNamePhoneSingle.mockClear();
    mpOwnerSingle.mockClear();
    matchGetSingle.mockClear();
    tripSingle.mockClear();
    locsIn.mockClear();
    mpNamePhoneSingle.mockResolvedValue({ data: BASE_MP_NAME_PHONE });
    mpOwnerSingle.mockResolvedValue({ data: BASE_MP_OWNER });
    matchGetSingle.mockResolvedValue({ data: BASE_MATCH });
    tripSingle.mockResolvedValue({ data: BASE_TRIP });
    locsIn.mockResolvedValue({ data: BASE_LOCS });
  });

  it("passengerId 기반 소유권 확인 후 매칭 정보 반환", async () => {
    const result = await getMatchForCancel("mp-1", "m-1");

    expect(result).not.toBeNull();
    expect(result!.matchId).toBe("m-1");
    expect(result!.status).toBe("awaiting_payment");
    expect(result!.reservationCode).toBe("BUS-7K9M");
    expect(result!.originLabel).toBe("서울역");
    expect(result!.destinationLabel).toBe("광주역");
  });

  it("match_passengers 행 없음 (passengerId 미존재) → null, 매칭 조회 미호출", async () => {
    mpNamePhoneSingle.mockResolvedValue({ data: null });
    const result = await getMatchForCancel("mp-unknown", "m-1");
    expect(result).toBeNull();
    expect(matchGetSingle).not.toHaveBeenCalled();
  });

  it("타인 매칭 (소유권 없음) → null, 매칭 조회 미호출", async () => {
    mpOwnerSingle.mockResolvedValue({ data: null });
    const result = await getMatchForCancel("mp-1", "m-other");
    expect(result).toBeNull();
    expect(matchGetSingle).not.toHaveBeenCalled();
  });

  it("출발 23시간 전 → isWithin24h true (D-1 안내 표시)", async () => {
    const departure = new Date("2026-08-01T07:00:00Z");
    const now = new Date(departure.getTime() - 23 * 60 * 60 * 1000);
    const result = await getMatchForCancel("mp-1", "m-1", now);
    expect(result!.isWithin24h).toBe(true);
  });

  it("출발 49시간 전 → isWithin24h false", async () => {
    const departure = new Date("2026-08-01T07:00:00Z");
    const now = new Date(departure.getTime() - 49 * 60 * 60 * 1000);
    const result = await getMatchForCancel("mp-1", "m-1", now);
    expect(result!.isWithin24h).toBe(false);
  });

  it("이미 출발한 경우 → isWithin24h false (출발 후는 D-1 아님)", async () => {
    const departure = new Date("2026-08-01T07:00:00Z");
    const now = new Date(departure.getTime() + 60 * 60 * 1000); // 1시간 후
    const result = await getMatchForCancel("mp-1", "m-1", now);
    expect(result!.isWithin24h).toBe(false);
  });

  it("이미 cancelled 상태 → 상태값 그대로 반환 (페이지에서 별도 처리)", async () => {
    matchGetSingle.mockResolvedValue({
      data: { ...BASE_MATCH, status: "cancelled" },
    });
    const result = await getMatchForCancel("mp-1", "m-1");
    expect(result!.status).toBe("cancelled");
  });
});

describe("cancelMatch", () => {
  beforeEach(() => {
    mpNamePhoneSingle.mockClear();
    mpOwnerSingle.mockClear();
    matchUpdateFn.mockClear();
    matchUpdateSelectFn.mockClear();
    mpNamePhoneSingle.mockResolvedValue({ data: BASE_MP_NAME_PHONE });
    mpOwnerSingle.mockResolvedValue({ data: BASE_MP_OWNER });
    matchUpdateSelectFn.mockResolvedValue({ data: [{ id: "m-1" }], error: null });
  });

  it("성공 취소: passengerId 기반 소유권 확인 후 matches 업데이트", async () => {
    const result = await cancelMatch("mp-1", "m-1", "일정 변경");

    expect(result).toEqual({ ok: true });
    expect(matchUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        cancellation_source: "passenger",
        cancellation_reason: "일정 변경",
      }),
    );
  });

  it("취소 사유 null → cancellation_reason null 저장", async () => {
    await cancelMatch("mp-1", "m-1", null);
    expect(matchUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ cancellation_reason: null }),
    );
  });

  it("match_passengers 없음 (passengerId 미존재) → unauthorized, DB update 미호출", async () => {
    mpNamePhoneSingle.mockResolvedValue({ data: null });
    const result = await cancelMatch("mp-unknown", "m-1", null);
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
    expect(matchUpdateFn).not.toHaveBeenCalled();
  });

  it("타인 매칭 (소유권 없음) → unauthorized, DB update 미호출", async () => {
    mpOwnerSingle.mockResolvedValue({ data: null });
    const result = await cancelMatch("mp-1", "m-other", null);
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
    expect(matchUpdateFn).not.toHaveBeenCalled();
  });

  it("이미 cancelled/expired → wrong_state (update 조건 미충족)", async () => {
    matchUpdateSelectFn.mockResolvedValue({ data: [], error: null });
    const result = await cancelMatch("mp-1", "m-1", null);
    expect(result).toEqual({ ok: false, reason: "wrong_state" });
  });

  it("DB 오류 → db_error", async () => {
    matchUpdateSelectFn.mockResolvedValue({
      data: null,
      error: new Error("DB error"),
    });
    const result = await cancelMatch("mp-1", "m-1", null);
    expect(result).toEqual({ ok: false, reason: "db_error" });
  });
});
