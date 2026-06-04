import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Firebase Admin messaging mock — sendEachForMulticast 캡처
const sendEachForMulticast = vi.fn();
vi.mock("@/lib/firebase/admin", () => ({
  pushMessaging: () => ({ sendEachForMulticast }),
  isPushConfigured: () => true,
}));

import { formatPush, sendPush } from "./push";

describe("formatPush (이벤트 → 푸시 문구)", () => {
  it("match_confirmed → 송금 안내 문구", () => {
    const c = formatPush("match_confirmed", { matchId: "m", tripId: "t" });
    expect(c.title).toBe("매칭 확정");
    expect(c.body).toContain("송금");
  });

  it("paid_code_issued → 예약번호를 본문에 포함", () => {
    const c = formatPush("paid_code_issued", { reservationCode: "BUS-7K9M" });
    expect(c.body).toContain("BUS-7K9M");
  });

  it("match_rejected → 사유를 본문에 반영", () => {
    expect(formatPush("match_rejected", { reason: "정원 초과" }).body).toContain(
      "정원 초과",
    );
  });

  it("알 수 없는 type → 안전한 기본 문구", () => {
    const c = formatPush("totally_unknown", null);
    expect(c.title).toBe("Bus Cignal");
    expect(c.body.length).toBeGreaterThan(0);
  });
});

describe("sendPush (FCM multicast)", () => {
  beforeEach(() => sendEachForMulticast.mockReset());

  it("토큰 0개 → SDK 호출 없이 no-op", async () => {
    const res = await sendPush([], { title: "t", body: "b" });
    expect(res).toEqual({ successCount: 0, failureCount: 0, invalidTokens: [] });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it("부분 실패 → 무효 토큰만 식별(정리 대상)", async () => {
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered" },
        },
        { success: false, error: { code: "messaging/internal-error" } }, // 일시 오류 → 토큰 유지
      ],
    });
    const res = await sendPush(["good", "dead", "temp"], { title: "t", body: "b" });
    expect(res.successCount).toBe(1);
    expect(res.invalidTokens).toEqual(["dead"]);
  });

  it("notification·data 페이로드를 그대로 전달", async () => {
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
    await sendPush(["tok"], { title: "제목", body: "본문" }, { type: "x" });
    const arg = sendEachForMulticast.mock.calls[0][0];
    expect(arg.tokens).toEqual(["tok"]);
    expect(arg.notification).toEqual({ title: "제목", body: "본문" });
    expect(arg.data).toEqual({ type: "x" });
  });
});
