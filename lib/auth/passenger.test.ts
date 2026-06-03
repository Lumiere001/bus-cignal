import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { cookiesGet, redirectFn, verifyTokenFn } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  redirectFn: vi.fn(),
  verifyTokenFn: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: cookiesGet }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectFn,
}));

vi.mock("./passenger-session", () => ({
  PASSENGER_COOKIE: "bc_passenger_session",
  verifyPassengerToken: verifyTokenFn,
}));

import { getPassengerSession, requirePassenger } from "./passenger";

const VALID_CLAIMS = {
  matchPassengerId: "mp-1",
  sessionToken: "tok-abc",
};

describe("getPassengerSession", () => {
  beforeEach(() => {
    cookiesGet.mockReset();
    verifyTokenFn.mockReset();
  });

  it("쿠키가 없으면 null 반환", async () => {
    cookiesGet.mockReturnValue(undefined);
    verifyTokenFn.mockResolvedValue(null);

    const result = await getPassengerSession();
    expect(result).toBeNull();
  });

  it("유효한 쿠키 → claims 반환", async () => {
    cookiesGet.mockReturnValue({ value: "valid-jwt" });
    verifyTokenFn.mockResolvedValue(VALID_CLAIMS);

    const result = await getPassengerSession();
    expect(result).toEqual(VALID_CLAIMS);
    expect(verifyTokenFn).toHaveBeenCalledWith("valid-jwt");
  });
});

describe("requirePassenger", () => {
  beforeEach(() => {
    cookiesGet.mockReset();
    verifyTokenFn.mockReset();
    redirectFn.mockReset();
  });

  it("세션 없음 → redirect('/') 호출 (no-session /me 접근 차단)", async () => {
    cookiesGet.mockReturnValue(undefined);
    verifyTokenFn.mockResolvedValue(null);

    await requirePassenger();
    expect(redirectFn).toHaveBeenCalledWith("/");
  });

  it("유효한 세션 → claims 반환, redirect 미호출", async () => {
    cookiesGet.mockReturnValue({ value: "valid-jwt" });
    verifyTokenFn.mockResolvedValue(VALID_CLAIMS);

    const result = await requirePassenger();
    expect(result).toEqual(VALID_CLAIMS);
    expect(redirectFn).not.toHaveBeenCalled();
  });
});
