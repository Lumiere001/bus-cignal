import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, validateMessageText } from "./message";

describe("validateMessageText", () => {
  it("정상 텍스트 → ok + trim", () => {
    const r = validateMessageText("  안녕하세요  ");
    expect(r).toEqual({ ok: true, text: "안녕하세요" });
  });

  it("빈 문자열 → empty", () => {
    expect(validateMessageText("")).toEqual({ ok: false, reason: "empty" });
  });

  it("공백만 → empty", () => {
    expect(validateMessageText("    ")).toEqual({ ok: false, reason: "empty" });
  });

  it("제어문자만 → 제거 후 empty", () => {
    // NUL(0x00), BEL(0x07), 백스페이스(0x08), DEL(0x7F)
    const controls = String.fromCharCode(0x00, 0x07, 0x08, 0x7f);
    const r = validateMessageText(controls);
    expect(r).toEqual({ ok: false, reason: "empty" });
  });

  it("줄바꿈은 허용", () => {
    const r = validateMessageText("첫 줄\n둘째 줄");
    expect(r).toEqual({ ok: true, text: "첫 줄\n둘째 줄" });
  });

  it("본문 중 제어문자는 제거", () => {
    // "a" + NUL + "bc" → "abc"
    const r = validateMessageText("a" + String.fromCharCode(0x00) + "bc");
    expect(r).toEqual({ ok: true, text: "abc" });
  });

  it("500자 정확히 → ok", () => {
    const r = validateMessageText("가".repeat(MAX_MESSAGE_LENGTH));
    expect(r.ok).toBe(true);
  });

  it("501자 → too_long", () => {
    const r = validateMessageText("가".repeat(MAX_MESSAGE_LENGTH + 1));
    expect(r).toEqual({ ok: false, reason: "too_long" });
  });

  it("이모지(서로게이트 페어)는 보존", () => {
    const r = validateMessageText("출발해요 🚌");
    expect(r).toEqual({ ok: true, text: "출발해요 🚌" });
  });
});
