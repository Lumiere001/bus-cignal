import { describe, it, expect } from "vitest";
import { nonEmpty, pickEarliest } from "./identity";

describe("pickEarliest — 자기치유 후보 선택 규칙", () => {
  it("후보 없음(null/undefined/빈 배열) → null", () => {
    expect(pickEarliest(null)).toBeNull();
    expect(pickEarliest(undefined)).toBeNull();
    expect(pickEarliest([])).toBeNull();
  });

  it("후보 1개 → 그 행", () => {
    const row = { id: "a", created_at: "2026-06-09T01:00:00+09:00" };
    expect(pickEarliest([row])).toBe(row);
  });

  it("후보 여럿 → created_at 가장 이른 행(입력 순서 무관)", () => {
    const rows = [
      { id: "third", created_at: "2026-06-11T12:57:00+09:00" },
      { id: "first", created_at: "2026-06-09T01:00:00+09:00" },
      { id: "second", created_at: "2026-06-11T01:31:00+09:00" },
    ];
    expect(pickEarliest(rows)?.id).toBe("first");
  });

  it("같은 시각 동률 → 앞선 후보 유지", () => {
    const rows = [
      { id: "a", created_at: "2026-06-09T01:00:00+09:00" },
      { id: "b", created_at: "2026-06-09T01:00:00+09:00" },
    ];
    expect(pickEarliest(rows)?.id).toBe("a");
  });

  it("타임존 표기가 달라도 시각 기준 비교(UTC vs KST)", () => {
    const rows = [
      { id: "kst", created_at: "2026-06-09T09:00:00+09:00" }, // = 00:00Z
      { id: "utc", created_at: "2026-06-09T08:00:00Z" }, // 더 늦음
    ];
    expect(pickEarliest(rows)?.id).toBe("kst");
  });
});

describe("nonEmpty", () => {
  it("빈 문자열·null·undefined → null", () => {
    expect(nonEmpty("")).toBeNull();
    expect(nonEmpty(null)).toBeNull();
    expect(nonEmpty(undefined)).toBeNull();
  });

  it("값이 있으면 그대로", () => {
    expect(nonEmpty("S-1234")).toBe("S-1234");
  });
});
