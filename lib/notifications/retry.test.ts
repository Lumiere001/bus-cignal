import { describe, expect, it } from "vitest";
import {
  isExhausted,
  isRetryDue,
  MAX_PUSH_ATTEMPTS,
  nextRetryDelayMs,
  reducePushAttempt,
  RETRY_DELAYS_MS,
} from "./retry";

describe("푸시 재시도 정책 (1m → 5m → 30m, SPEC §8·§9.5)", () => {
  it("지연 단계가 1m·5m·30m", () => {
    expect(RETRY_DELAYS_MS).toEqual([60_000, 300_000, 1_800_000]);
    expect(MAX_PUSH_ATTEMPTS).toBe(3);
  });

  it("nextRetryDelayMs: 0→1m, 1→5m, 2→30m, 3→null", () => {
    expect(nextRetryDelayMs(0)).toBe(60_000);
    expect(nextRetryDelayMs(1)).toBe(300_000);
    expect(nextRetryDelayMs(2)).toBe(1_800_000);
    expect(nextRetryDelayMs(3)).toBeNull();
    expect(nextRetryDelayMs(-1)).toBeNull();
  });

  it("isExhausted: 3회부터 소진", () => {
    expect(isExhausted(2)).toBe(false);
    expect(isExhausted(3)).toBe(true);
  });

  it("reducePushAttempt: 성공", () => {
    expect(reducePushAttempt(0, true)).toEqual({ status: "sent" });
  });

  it("reducePushAttempt: 초기 실패 → 1m 후 재시도", () => {
    expect(reducePushAttempt(0, false)).toEqual({
      status: "pending",
      retryCount: 1,
      nextDelayMs: 60_000,
    });
  });

  it("reducePushAttempt: 3번째 재시도 → 30m", () => {
    expect(reducePushAttempt(2, false)).toEqual({
      status: "pending",
      retryCount: 3,
      nextDelayMs: 1_800_000,
    });
  });

  it("reducePushAttempt: 소진 → 실패 + 마스터 알림", () => {
    expect(reducePushAttempt(3, false)).toEqual({
      status: "failed",
      retryCount: 3,
      alertMaster: true,
    });
  });

  describe("isRetryDue (백오프 게이트)", () => {
    const T0 = 1_000_000_000_000; // 고정 기준 ms
    const at = (ms: number) => new Date(ms).toISOString();

    it("아직 시도 전(last_attempt_at null) → 즉시 due", () => {
      expect(isRetryDue(0, null, T0)).toBe(true);
      expect(isRetryDue(2, null, T0)).toBe(true);
    });

    it("retry_count=0 이면 항상 due", () => {
      expect(isRetryDue(0, at(T0), T0 + 999_999)).toBe(true);
    });

    it("retry_count=1 → 직전 시도 1m 경과해야 due", () => {
      expect(isRetryDue(1, at(T0), T0 + 59_000)).toBe(false);
      expect(isRetryDue(1, at(T0), T0 + 60_000)).toBe(true);
    });

    it("retry_count=2 → 5m, retry_count=3 → 30m", () => {
      expect(isRetryDue(2, at(T0), T0 + 4 * 60_000)).toBe(false);
      expect(isRetryDue(2, at(T0), T0 + 5 * 60_000)).toBe(true);
      expect(isRetryDue(3, at(T0), T0 + 29 * 60_000)).toBe(false);
      expect(isRetryDue(3, at(T0), T0 + 30 * 60_000)).toBe(true);
    });

    it("단계 초과(retry_count>3) → due 아님(곧 failed 처리)", () => {
      expect(isRetryDue(4, at(T0), T0 + 10 * 60 * 60_000)).toBe(false);
    });
  });
});
