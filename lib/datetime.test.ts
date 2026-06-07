import { describe, expect, it } from "vitest";
import {
  formatKstDateShort,
  formatKstDateTime,
  formatKstShort,
  formatWon,
} from "./datetime";

describe("formatKstDateTime (operator 화면, KST 12h)", () => {
  it("오후 시각을 2자리 12시간제 + 오전/오후로 표시 (KST)", () => {
    // 2026-03-05T05:30:00Z = KST 14:30 → 오후 02:30
    expect(formatKstDateTime("2026-03-05T05:30:00.000Z")).toBe("3월 5일 오후 02:30");
  });

  it("오전 시각", () => {
    // 2026-03-05T00:07:00Z = KST 09:07 → 오전 09:07
    expect(formatKstDateTime("2026-03-05T00:07:00.000Z")).toBe("3월 5일 오전 09:07");
  });

  it("KST 자정 경계 — 오전 12:00 + 날짜 넘김", () => {
    // 2026-03-05T15:00:00Z = KST 03-06 00:00 → 오전 12:00 (6일)
    expect(formatKstDateTime("2026-03-05T15:00:00.000Z")).toBe("3월 6일 오전 12:00");
  });

  it("year 옵션 시 연도 접두", () => {
    expect(formatKstDateTime("2026-03-05T05:30:00.000Z", { year: true })).toBe(
      "2026년 3월 5일 오후 02:30",
    );
  });

  it("결정적 — 같은 입력은 항상 같은 문자열(toLocaleString 미사용)", () => {
    const iso = "2026-07-04T16:30:00Z";
    expect(formatKstDateTime(iso)).toBe(formatKstDateTime(iso));
    expect(formatKstDateTime(iso)).toBe("7월 5일 오전 01:30");
  });
});

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
