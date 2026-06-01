import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  anonymizeMatchPassengerFields,
  anonymizeOperatorFields,
  anonymizeRequestPassengerFields,
  sha,
} from "./anonymize";

const hashOf = (v: string) => createHash("sha256").update(v).digest("hex");

describe("anonymize (PIPA §10.3 익명화)", () => {
  it("sha: 값→sha256, null·빈문자열→null", () => {
    expect(sha("010-1234-5678")).toBe(hashOf("010-1234-5678"));
    expect(sha(null)).toBeNull();
    expect(sha(undefined)).toBeNull();
    expect(sha("")).toBeNull();
  });

  it("request_passenger: 이름·전화·자유노트 제거, school_or_role은 보존(통계)", () => {
    const out = anonymizeRequestPassengerFields({ phone: "010-1111-2222" });
    expect(out).toEqual({
      name: "○○○",
      phone: hashOf("010-1111-2222"),
      note: null,
      anonymized: true,
    });
    // school_or_role은 덮어쓰지 않음 (update 객체에 없음 → 기존 값 유지)
    expect("school_or_role" in out).toBe(false);
  });

  it("match_passenger: 이름·전화 제거, school_or_role 보존", () => {
    const out = anonymizeMatchPassengerFields({ phone: "010-3333-4444" });
    expect(out).toEqual({
      name: "○○○",
      phone: hashOf("010-3333-4444"),
      anonymized: true,
    });
    expect("school_or_role" in out).toBe(false);
  });

  it("operator: 이름·전화·이메일 해시, null은 null 유지", () => {
    expect(
      anonymizeOperatorFields({ phone: "010-5555", email: "a@b.com" }),
    ).toEqual({
      name: "○○○",
      phone: hashOf("010-5555"),
      email: hashOf("a@b.com"),
      anonymized: true,
    });
    expect(anonymizeOperatorFields({ phone: null, email: null })).toEqual({
      name: "○○○",
      phone: null,
      email: null,
      anonymized: true,
    });
  });

  it("해시는 결정적 — 같은 전화는 테이블 달라도 동일 (집계 가능, 원문 복원 불가)", () => {
    const p = "010-9999-0000";
    expect(anonymizeRequestPassengerFields({ phone: p }).phone).toBe(
      anonymizeMatchPassengerFields({ phone: p }).phone,
    );
  });
});
