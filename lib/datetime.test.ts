import { describe, expect, it } from "vitest";
import { formatKstDateShort, formatKstShort, formatWon } from "./datetime";

describe("formatKstDateShort (학생 화면, KST 24h)", () => {
  it("UTC instant을 KST로 변환해 표시 (TZ 교정)", () => {
    // 2026-07-04T16:30:00Z = KST 2026-07-05 01:30
    const out = formatKstDateShort("2026-07-04T16:30:00Z");
    expect(out).toContain("5일"); // KST 날짜(5일) — UTC였다면 4일
    expect(out).not.toContain("4일");
    expect(out).toMatch(/0?1:30/); // 01:30 (KST)
  });

  it("KST 자정 직전 — 날짜 경계 정확", () => {
    // 2026-07-05T14:59:00Z = KST 2026-07-05 23:59
    const out = formatKstDateShort("2026-07-05T14:59:00Z");
    expect(out).toContain("5일");
    expect(out).toMatch(/23:59/);
  });
});

describe("formatWon", () => {
  it("천단위 구분 + 원", () => {
    expect(formatWon(35000)).toBe("35,000원");
    expect(formatWon(0)).toBe("0원");
    expect(formatWon(1050000)).toBe("1,050,000원");
  });
});

describe("formatKstShort (기존, admin 짧은 형식)", () => {
  it("MM/DD HH:MM (KST)", () => {
    // 2026-07-04T16:30:00Z = KST 07/05 01:30
    expect(formatKstShort("2026-07-04T16:30:00Z")).toBe("07/05 01:30");
  });
});
