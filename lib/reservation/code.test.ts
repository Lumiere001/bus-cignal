import { describe, it, expect } from "vitest";
import {
  generateReservationCode,
  isValidReservationCode,
  RESERVATION_PREFIX,
} from "./code";

const FORBIDDEN = ["0", "1", "I", "O", "L", "Z"];

describe("generateReservationCode()", () => {
  it("BUS- 접두 + 4자 형식", () => {
    const code = generateReservationCode(() => 0);
    expect(code.startsWith(RESERVATION_PREFIX)).toBe(true);
    expect(code).toHaveLength(RESERVATION_PREFIX.length + 4);
  });

  it("rng=0 → 첫 글자(2)만 반복: BUS-2222", () => {
    expect(generateReservationCode(() => 0)).toBe("BUS-2222");
  });

  it("rng→1 근접 → 마지막 글자(Y): BUS-YYYY", () => {
    expect(generateReservationCode(() => 0.999999)).toBe("BUS-YYYY");
  });

  it("혼동 글자(0·1·I·O·L·Z)를 절대 포함하지 않음", () => {
    // 알파벳 전 구간을 훑는 rng로 30글자 모두 검사
    for (let i = 0; i < 30; i += 1) {
      const code = generateReservationCode(() => i / 30);
      const body = code.slice(RESERVATION_PREFIX.length);
      for (const ch of body) {
        expect(FORBIDDEN).not.toContain(ch);
      }
    }
  });

  it("생성된 코드는 항상 isValid 통과", () => {
    let r = 0.123;
    const next = () => {
      r = (r * 9301 + 49297) % 233280 / 233280; // 결정적 의사난수
      return r;
    };
    for (let i = 0; i < 200; i += 1) {
      expect(isValidReservationCode(generateReservationCode(next))).toBe(true);
    }
  });
});

describe("isValidReservationCode()", () => {
  it("올바른 형식 통과", () => {
    expect(isValidReservationCode("BUS-7K9M")).toBe(true);
  });

  it.each([
    ["접두 없음", "7K9M"],
    ["혼동 글자 O 포함", "BUS-7O9M"],
    ["혼동 글자 0 포함", "BUS-7099"],
    ["길이 부족", "BUS-7K9"],
    ["길이 초과", "BUS-7K9MM"],
    ["소문자", "BUS-7k9m"],
    ["빈 문자열", ""],
  ])("%s → 거부", (_label, code) => {
    expect(isValidReservationCode(code)).toBe(false);
  });
});
