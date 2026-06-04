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
});
