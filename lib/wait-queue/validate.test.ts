import { describe, expect, it } from "vitest";
import {
  hasDuplicateWaitRequest,
  isWaitDirection,
  validateDesiredDate,
  validateOperatorWaitRegion,
  validateWaitAssignment,
  type WaitAssignRequestRow,
  type WaitAssignTripRow,
} from "./validate";

describe("isWaitDirection", () => {
  it("가는편(up)/오는편(down)만 허용", () => {
    expect(isWaitDirection("up")).toBe(true);
    expect(isWaitDirection("down")).toBe(true);
  });

  it("그 외 값은 전부 거부", () => {
    expect(isWaitDirection("UP")).toBe(false);
    expect(isWaitDirection("round")).toBe(false);
    expect(isWaitDirection("")).toBe(false);
    expect(isWaitDirection(null)).toBe(false);
    expect(isWaitDirection(undefined)).toBe(false);
    expect(isWaitDirection(1)).toBe(false);
  });
});

describe("validateDesiredDate", () => {
  it("빈 값(null/undefined/공백)은 '희망일 없음'으로 통과", () => {
    expect(validateDesiredDate(null)).toEqual({ ok: true, value: null });
    expect(validateDesiredDate(undefined)).toEqual({ ok: true, value: null });
    expect(validateDesiredDate("   ")).toEqual({ ok: true, value: null });
  });

  it("YYYY-MM-DD 형식의 실존 날짜는 통과 (trim 포함)", () => {
    expect(validateDesiredDate("2026-07-01")).toEqual({
      ok: true,
      value: "2026-07-01",
    });
    expect(validateDesiredDate(" 2026-07-01 ")).toEqual({
      ok: true,
      value: "2026-07-01",
    });
  });

  it("과거 날짜는 관대하게 허용 (형식만 본다)", () => {
    expect(validateDesiredDate("2020-01-01")).toEqual({
      ok: true,
      value: "2020-01-01",
    });
  });

  it("형식 위반은 거부", () => {
    expect(validateDesiredDate("2026-7-1").ok).toBe(false);
    expect(validateDesiredDate("07-01-2026").ok).toBe(false);
    expect(validateDesiredDate("20260701").ok).toBe(false);
    expect(validateDesiredDate("내일").ok).toBe(false);
  });

  it("형식만 맞는 가짜 날짜는 거부 (2026-02-31, 13월)", () => {
    expect(validateDesiredDate("2026-02-31").ok).toBe(false);
    expect(validateDesiredDate("2026-13-01").ok).toBe(false);
    expect(validateDesiredDate("2026-00-10").ok).toBe(false);
  });

  it("윤년 경계 — 2028-02-29 통과, 2026-02-29 거부", () => {
    expect(validateDesiredDate("2028-02-29")).toEqual({
      ok: true,
      value: "2028-02-29",
    });
    expect(validateDesiredDate("2026-02-29").ok).toBe(false);
  });
});

describe("validateOperatorWaitRegion (간사 — 본인 지구 금지)", () => {
  const MY_REGION = "region-me";

  it("타지구는 통과", () => {
    expect(validateOperatorWaitRegion({ id: "region-other" }, MY_REGION)).toEqual({
      ok: true,
    });
  });

  it("지구 조회 결과가 없으면(실존 X) 거부", () => {
    const result = validateOperatorWaitRegion(null, MY_REGION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("지구를 찾을 수 없습니다");
  });

  it("본인 지구 대기큐 신청은 거부", () => {
    const result = validateOperatorWaitRegion({ id: MY_REGION }, MY_REGION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("본인 지구 대기큐");
  });
});

describe("hasDuplicateWaitRequest (학생 — 중복 가드)", () => {
  const REGION = "region-a";

  it("같은 지구 + 같은 방향이 이미 있으면 중복", () => {
    expect(
      hasDuplicateWaitRequest(
        [{ wait_region_id: REGION, wait_direction: "up" }],
        REGION,
        "up",
      ),
    ).toBe(true);
  });

  it("같은 지구라도 방향이 다르면(가는편 vs 오는편) 중복 아님", () => {
    expect(
      hasDuplicateWaitRequest(
        [{ wait_region_id: REGION, wait_direction: "up" }],
        REGION,
        "down",
      ),
    ).toBe(false);
  });

  it("같은 방향이라도 지구가 다르면 중복 아님", () => {
    expect(
      hasDuplicateWaitRequest(
        [{ wait_region_id: "region-b", wait_direction: "up" }],
        REGION,
        "up",
      ),
    ).toBe(false);
  });

  it("기존 미배정 대기 신청이 없으면 중복 아님", () => {
    expect(hasDuplicateWaitRequest([], REGION, "up")).toBe(false);
  });

  it("여러 건 중 하나라도 일치하면 중복", () => {
    expect(
      hasDuplicateWaitRequest(
        [
          { wait_region_id: "region-b", wait_direction: "down" },
          { wait_region_id: REGION, wait_direction: "down" },
          { wait_region_id: REGION, wait_direction: "up" },
        ],
        REGION,
        "up",
      ),
    ).toBe(true);
  });
});

describe("validateWaitAssignment (공급 간사 — 버스로 이동)", () => {
  const MY_REGION = "region-supply";

  const waitRequest = (over: Partial<WaitAssignRequestRow> = {}): WaitAssignRequestRow => ({
    status: "queued",
    trip_id: null,
    wait_region_id: MY_REGION,
    wait_direction: "up",
    ...over,
  });

  const publishedTrip = (over: Partial<WaitAssignTripRow> = {}): WaitAssignTripRow => ({
    status: "published",
    direction: "up",
    ...over,
  });

  it("내 지구 대기큐의 queued 미배정 신청 + 내 지구 published 동일 방향 trip → 통과", () => {
    expect(validateWaitAssignment(waitRequest(), publishedTrip(), MY_REGION)).toEqual({
      ok: true,
    });
  });

  it("신청이 없으면 거부", () => {
    const result = validateWaitAssignment(null, publishedTrip(), MY_REGION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("대기 신청을 찾을 수 없습니다");
  });

  it("타지구 대기큐 신청은 못 찾은 것으로 거부 (권한 = wait_region_id 본인 지구)", () => {
    const result = validateWaitAssignment(
      waitRequest({ wait_region_id: "region-other" }),
      publishedTrip(),
      MY_REGION,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("대기 신청을 찾을 수 없습니다");
  });

  it("이미 trip이 배정된 신청은 거부", () => {
    const result = validateWaitAssignment(
      waitRequest({ trip_id: "trip-1" }),
      publishedTrip(),
      MY_REGION,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("이미 버스가 배정된 신청");
  });

  it("queued가 아닌(rejected/cancelled/matched) 신청은 거부", () => {
    for (const status of ["rejected", "cancelled", "matched"]) {
      const result = validateWaitAssignment(
        waitRequest({ status }),
        publishedTrip(),
        MY_REGION,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("이미 처리된 신청");
    }
  });

  it("차량이 없으면(타지구 trip 포함 — 본인 지구로 좁혀 조회) 거부", () => {
    const result = validateWaitAssignment(waitRequest(), null, MY_REGION);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("차량을 찾을 수 없습니다");
  });

  it("published가 아닌 차량은 거부", () => {
    for (const status of ["draft", "closed", "cancelled"]) {
      const result = validateWaitAssignment(
        waitRequest(),
        publishedTrip({ status }),
        MY_REGION,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("published");
    }
  });

  it("방향 불일치(가는편 신청 ↔ 오는편 차량)는 거부", () => {
    const result = validateWaitAssignment(
      waitRequest({ wait_direction: "up" }),
      publishedTrip({ direction: "down" }),
      MY_REGION,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("방향");
  });
});
