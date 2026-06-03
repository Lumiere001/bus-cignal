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

describe("passenger-session", () => {
  it("signs and verifies passenger claims", async () => {
    const token = await signPassengerToken({ passengerId: "mp-123" });

    expect(await verifyPassengerToken(token)).toEqual({
      passengerId: "mp-123",
    });
  });

  it("returns null for a missing token", async () => {
    expect(await verifyPassengerToken(undefined)).toBeNull();
  });

  it("returns null for an invalid token", async () => {
    expect(await verifyPassengerToken("garbage.token.value")).toBeNull();
  });

  it("rejects tokens with a non-passenger role", async () => {
    const forged = await new SignJWT({
      role: "operator",
      passengerId: "x",
    })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(process.env.PASSENGER_SESSION_SECRET!));

    expect(await verifyPassengerToken(forged)).toBeNull();
  });

  it("exports the passenger cookie name and session duration", () => {
    expect(PASSENGER_COOKIE).toBe("bc_passenger_session");
    expect(PASSENGER_SESSION_DAYS).toBe(30);
  });
});
