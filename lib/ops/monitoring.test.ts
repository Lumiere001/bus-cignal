import { describe, expect, it } from "vitest";
import {
  DB_CRIT_RATIO,
  DB_WARN_RATIO,
  NOTIF_FAIL_WARN,
  REQUEST_SPIKE_WARN,
  evaluateSignals,
  formatBytes,
} from "./monitoring";

describe("formatBytes", () => {
  it("0 이하는 0 B", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
  });
  it("B는 소수점 없음", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
  it("MB/GB는 소수 1자리", () => {
    expect(formatBytes(13_167_763)).toBe("12.6 MB");
    expect(formatBytes(500 * 1024 * 1024)).toBe("500.0 MB");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2.0 GB");
  });
});

describe("evaluateSignals — Supabase Pro 권장 신호", () => {
  const calm = { dbRatio: 0.1, todayRequests: 10, todayNotifFailed: 0 };

  it("모두 한가하면 ok·신호 없음", () => {
    const r = evaluateSignals(calm);
    expect(r.level).toBe("ok");
    expect(r.signals).toHaveLength(0);
  });

  it("DB 80%↑ = warn, 90%↑ = crit", () => {
    expect(evaluateSignals({ ...calm, dbRatio: DB_WARN_RATIO }).level).toBe("warn");
    expect(evaluateSignals({ ...calm, dbRatio: DB_CRIT_RATIO }).level).toBe("crit");
    // 79%는 아직 ok
    expect(evaluateSignals({ ...calm, dbRatio: 0.79 }).level).toBe("ok");
  });

  it("DB는 warn/crit 중 하나만 (중복 신호 X)", () => {
    const r = evaluateSignals({ ...calm, dbRatio: 0.95 });
    expect(r.signals.filter((s) => s.title.startsWith("DB 용량"))).toHaveLength(1);
    expect(r.signals[0].level).toBe("crit");
  });

  it("알림 실패 임계 도달 시 warn 신호 추가", () => {
    const r = evaluateSignals({ ...calm, todayNotifFailed: NOTIF_FAIL_WARN });
    expect(r.level).toBe("warn");
    expect(r.signals.some((s) => s.title === "알림 실패 누적")).toBe(true);
  });

  it("신청 폭주 임계 도달 시 warn 신호 추가", () => {
    const r = evaluateSignals({ ...calm, todayRequests: REQUEST_SPIKE_WARN });
    expect(r.signals.some((s) => s.title === "신청 폭주")).toBe(true);
  });

  it("crit 1개 + warn 여러개면 전체 level은 crit", () => {
    const r = evaluateSignals({
      dbRatio: 0.95,
      todayRequests: REQUEST_SPIKE_WARN,
      todayNotifFailed: NOTIF_FAIL_WARN,
    });
    expect(r.level).toBe("crit");
    expect(r.signals.length).toBeGreaterThanOrEqual(3);
  });
});
