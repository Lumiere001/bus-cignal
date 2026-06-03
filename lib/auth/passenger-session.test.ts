import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  PASSENGER_COOKIE,
  PASSENGER_SESSION_DAYS,
  signPassengerToken,
  verifyPassengerToken,
} from "./passenger-session";

beforeAll(() => {
  process.env.PASSENGER_SESSION_SECRET =
    "test-passenger-session-secret-please-32+chars-long";
});

describe("passenger-session (학생 세션 JWT)", () => {
  it("발급 → 검증 roundtrip", async () => {
    const token = await signPassengerToken({ passengerId: "mp-123" });
    expect(await verifyPassengerToken(token)).toEqual({ passengerId: "mp-123" });
  });

  it("토큰 없음 → null", async () => {
    expect(await verifyPassengerToken(undefined)).toBeNull();
  });

  it("위조·깨진 토큰 → null", async () => {
    expect(await verifyPassengerToken("garbage.token.value")).toBeNull();
  });

  it("다른 role 토큰은 거부 — operator/master 토큰으로 학생 위장 불가", async () => {
    const forged = await new SignJWT({ role: "operator", passengerId: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(process.env.PASSENGER_SESSION_SECRET!));
    expect(await verifyPassengerToken(forged)).toBeNull();
  });

  it("쿠키 이름·세션 기간 상수 (SPEC §3.S5: 30일)", () => {
    expect(PASSENGER_COOKIE).toBe("bc_passenger_session");
    expect(PASSENGER_SESSION_DAYS).toBe(30);
  });
});
