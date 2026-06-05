import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// match_passengers 첫 번째 호출 (passengerId → name+phone)
const mpSingleMock = vi.fn();
// match_passengers 두 번째 호출 (name+phone → match_ids)
const mpMultiEq1 = vi.fn();
const mpMultiEq2 = vi.fn();
// matches: .in().eq().maybeSingle()
const matchesMaybeSingle = vi.fn();
// trips: .eq().maybeSingle()
const tripMaybeSingle = vi.fn();
// region_locations: .in()
const locsIn = vi.fn();
// operators: .eq().maybeSingle() (담당 간사 연락처)
const operatorMaybeSingle = vi.fn();

let mpFromIdx = 0;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "match_passengers") {
        mpFromIdx++;
        if (mpFromIdx === 1) {
          return { select: () => ({ eq: () => ({ maybeSingle: mpSingleMock }) }) };
        }
        // 2nd: .select("match_id").eq("phone",...).eq("name",...)
        return { select: () => ({ eq: mpMultiEq1 }) };
      }
      if (table === "matches") {
        // .select("id").in(matchIds).eq("trip_id", tripId).maybeSingle()
        return {
          select: () => ({
            in: () => ({
              eq: () => ({ maybeSingle: matchesMaybeSingle }),
            }),
          }),
        };
      }
      if (table === "trips") {
        // .select("...").eq("id", tripId).maybeSingle()
        return { select: () => ({ eq: () => ({ maybeSingle: tripMaybeSingle }) }) };
      }
      if (table === "region_locations") {
        // .select("...").in(locIds)  ← 터미널이 .in()
        return { select: () => ({ in: locsIn }) };
      }
      if (table === "operators") {
        // .select("name, phone").eq("id", created_by).maybeSingle()
        return {
          select: () => ({ eq: () => ({ maybeSingle: operatorMaybeSingle }) }),
        };
      }
      return { select: () => ({ eq: () => {}, in: () => {} }) };
    },
  }),
}));

import { getTripForPassenger } from "./trip-detail";

const BASE_MP = { name: "이지은", phone: "010-1234-5678" };

const BASE_TRIP = {
  id: "t-1",
  departure_at: "2026-08-01T07:00:00Z",
  price_per_seat: 35000,
  direction: "to",
  origin_location_id: "loc-1",
  destination_location_id: "loc-2",
};

const BASE_LOCS = [
  { id: "loc-1", address: "서울역 1번 출구", label: "서울역", lat: 37.5547, lng: 126.9706 },
  { id: "loc-2", address: "광주역 2번 출구", label: "광주역", lat: 35.1595, lng: 126.8526 },
];

describe("getTripForPassenger", () => {
  beforeEach(() => {
    mpFromIdx = 0;
    mpSingleMock.mockResolvedValue({ data: BASE_MP });
    mpMultiEq1.mockReturnValue({ eq: mpMultiEq2 });
    mpMultiEq2.mockResolvedValue({ data: [{ match_id: "m-1" }] });
    matchesMaybeSingle.mockResolvedValue({ data: { id: "m-1" } });
    tripMaybeSingle.mockResolvedValue({ data: BASE_TRIP });
    locsIn.mockResolvedValue({ data: BASE_LOCS });
    operatorMaybeSingle.mockResolvedValue({
      data: { name: "김광주", phone: "010-9999-0000" },
    });
  });

  it("passengerId 없음 → null, 이후 조회 미호출", async () => {
    mpSingleMock.mockResolvedValue({ data: null });
    const result = await getTripForPassenger("mp-x", "t-1");
    expect(result).toBeNull();
    expect(matchesMaybeSingle).not.toHaveBeenCalled();
    expect(tripMaybeSingle).not.toHaveBeenCalled();
    expect(locsIn).not.toHaveBeenCalled();
  });

  it("소유하지 않은 trip → null, trip 조회 미호출", async () => {
    matchesMaybeSingle.mockResolvedValue({ data: null });
    const result = await getTripForPassenger("mp-1", "t-other");
    expect(result).toBeNull();
    expect(tripMaybeSingle).not.toHaveBeenCalled();
  });

  it("trip DB 조회 실패 → null", async () => {
    tripMaybeSingle.mockResolvedValue({ data: null });
    const result = await getTripForPassenger("mp-1", "t-1");
    expect(result).toBeNull();
  });

  it("정상 케이스 → TripDetail 반환", async () => {
    const result = await getTripForPassenger("mp-1", "t-1");
    expect(result).not.toBeNull();
    expect(result!.tripId).toBe("t-1");
    expect(result!.originLabel).toBe("서울역");
    expect(result!.originAddress).toBe("서울역 1번 출구");
    expect(result!.destinationLabel).toBe("광주역");
    expect(result!.destinationAddress).toBe("광주역 2번 출구");
    expect(result!.pricePerSeat).toBe(35000);
  });

  it("좌표 있음 → originLat/originLng 반환", async () => {
    const result = await getTripForPassenger("mp-1", "t-1");
    expect(result!.originLat).toBe(37.5547);
    expect(result!.originLng).toBe(126.9706);
  });

  it("좌표 없음 → originLat/originLng null", async () => {
    locsIn.mockResolvedValue({
      data: [
        { id: "loc-1", address: "서울역 1번 출구", label: "서울역", lat: null, lng: null },
        { id: "loc-2", address: "광주역 2번 출구", label: "광주역", lat: null, lng: null },
      ],
    });
    const result = await getTripForPassenger("mp-1", "t-1");
    expect(result!.originLat).toBeNull();
    expect(result!.originLng).toBeNull();
  });

  it("label null → address를 label로 대체", async () => {
    locsIn.mockResolvedValue({
      data: [
        { id: "loc-1", address: "서울역 1번 출구", label: null, lat: null, lng: null },
        { id: "loc-2", address: "광주역 2번 출구", label: null, lat: null, lng: null },
      ],
    });
    const result = await getTripForPassenger("mp-1", "t-1");
    expect(result!.originLabel).toBe("서울역 1번 출구");
    expect(result!.destinationLabel).toBe("광주역 2번 출구");
  });

  it("name+phone 필터를 모두 사용 (phone 단독 조회 방지)", async () => {
    await getTripForPassenger("mp-1", "t-1");
    expect(mpMultiEq1).toHaveBeenCalledWith("phone", "010-1234-5678");
    expect(mpMultiEq2).toHaveBeenCalledWith("name", "이지은");
  });

  it("created_by 있음 → 담당 간사·총무 연락처 반환 (§S5)", async () => {
    tripMaybeSingle.mockResolvedValue({
      data: {
        ...BASE_TRIP,
        created_by: "op-1",
        treasurer_name: "박총무",
        treasurer_phone: "010-1111-2222",
      },
    });
    const result = await getTripForPassenger("mp-1", "t-1");
    expect(result!.operatorName).toBe("김광주");
    expect(result!.operatorPhone).toBe("010-9999-0000");
    expect(result!.treasurerName).toBe("박총무");
    expect(result!.treasurerPhone).toBe("010-1111-2222");
  });

  it("created_by 없음 → 간사·총무 null (연락처 카드 미노출)", async () => {
    // BASE_TRIP은 created_by/treasurer 없음 → 조회 skip, null
    const result = await getTripForPassenger("mp-1", "t-1");
    expect(result!.operatorName).toBeNull();
    expect(result!.operatorPhone).toBeNull();
    expect(result!.treasurerName).toBeNull();
    expect(result!.treasurerPhone).toBeNull();
  });
});
