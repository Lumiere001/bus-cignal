import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// vi.mock 팩토리는 호이스팅되므로 vi.hoisted()로 mock 함수를 먼저 선언
const { mockRedirect, mockGetPassengerSession, mockCancelMatch } = vi.hoisted(
  () => ({
    mockRedirect: vi.fn(),
    mockGetPassengerSession: vi.fn(),
    mockCancelMatch: vi.fn(),
  }),
);

// next/navigation의 redirect는 특수 에러를 throw. NEXT_REDIRECT:<url> 형태로 식별.
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/auth/passenger", () => ({
  getPassengerSession: mockGetPassengerSession,
}));
vi.mock("@/lib/passenger/cancel", () => ({
  cancelMatch: mockCancelMatch,
}));

import { cancelMatchAction } from "@/app/me/cancel/[matchId]/actions";

const MOCK_SESSION = { passengerId: "mp-1" };

describe("cancelMatchAction — confirm 서버 검증", () => {
  beforeEach(() => {
    mockRedirect.mockReset();
    mockGetPassengerSession.mockReset();
    mockCancelMatch.mockReset();
    mockGetPassengerSession.mockResolvedValue(MOCK_SESSION);
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
  });

  it("confirm 누락 (체크박스 미체크) → cancelMatch 미호출, confirm_required redirect", async () => {
    const formData = new FormData();
    // confirmed 필드 없음 = 체크박스 미체크 상태

    await expect(cancelMatchAction("m-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/me/cancel/m-1?error=confirm_required",
    );
    expect(mockCancelMatch).not.toHaveBeenCalled();
  });

  it("confirm = 'off' → cancelMatch 미호출", async () => {
    const formData = new FormData();
    formData.append("confirmed", "off");

    await expect(cancelMatchAction("m-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/me/cancel/m-1?error=confirm_required",
    );
    expect(mockCancelMatch).not.toHaveBeenCalled();
  });

  it("confirm = 'on' + 정상 취소 → cancelMatch 호출 후 /me?cancelled=1 redirect", async () => {
    mockCancelMatch.mockResolvedValue({ ok: true });
    const formData = new FormData();
    formData.append("confirmed", "on");
    formData.append("reason", "일정 변경");

    await expect(cancelMatchAction("m-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/me?cancelled=1",
    );
    expect(mockCancelMatch).toHaveBeenCalledWith("mp-1", "m-1", "일정 변경");
  });

  it("confirm = 'on' + 사유 없음 → reason null로 cancelMatch 호출", async () => {
    mockCancelMatch.mockResolvedValue({ ok: true });
    const formData = new FormData();
    formData.append("confirmed", "on");

    await expect(cancelMatchAction("m-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/me?cancelled=1",
    );
    expect(mockCancelMatch).toHaveBeenCalledWith("mp-1", "m-1", null);
  });

  it("세션 없음 → / redirect, cancelMatch 미호출", async () => {
    mockGetPassengerSession.mockResolvedValue(null);
    const formData = new FormData();
    formData.append("confirmed", "on");

    await expect(cancelMatchAction("m-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );
    expect(mockCancelMatch).not.toHaveBeenCalled();
  });

  it("cancelMatch unauthorized → /me redirect", async () => {
    mockCancelMatch.mockResolvedValue({ ok: false, reason: "unauthorized" });
    const formData = new FormData();
    formData.append("confirmed", "on");

    await expect(cancelMatchAction("m-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/me",
    );
  });

  it("cancelMatch wrong_state → /me/cancel/:matchId?error=wrong_state redirect", async () => {
    mockCancelMatch.mockResolvedValue({ ok: false, reason: "wrong_state" });
    const formData = new FormData();
    formData.append("confirmed", "on");

    await expect(cancelMatchAction("m-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/me/cancel/m-1?error=wrong_state",
    );
  });
});
