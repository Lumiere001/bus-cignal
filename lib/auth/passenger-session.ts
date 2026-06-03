import { SignJWT, jwtVerify } from "jose";

// Edge-compatible passenger session helpers. Do not import server-only here.
const ALG = "HS256";
export const PASSENGER_COOKIE = "bc_passenger_session";
export const PASSENGER_SESSION_DAYS = 30;

export type PassengerClaims = {
  matchPassengerId: string;
  /** Raw token issued after verification; SHA-256 must match access_token_hash. */
  sessionToken: string;
};

function secret(): Uint8Array {
  const value = process.env.PASSENGER_SESSION_SECRET;
  if (!value)
    throw new Error("PASSENGER_SESSION_SECRET environment variable is not set.");
  return new TextEncoder().encode(value);
}

/** Issue a passenger JWT after reservation code, name, and phone verification. */
export async function signPassengerToken(
  claims: PassengerClaims,
): Promise<string> {
  return new SignJWT({ role: "passenger", ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${PASSENGER_SESSION_DAYS}d`)
    .sign(secret());
}

/** Verify a passenger session token and return claims. Invalid tokens return null. */
export async function verifyPassengerToken(
  token: string | undefined,
): Promise<PassengerClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "passenger") return null;
    if (!payload.matchPassengerId || !payload.sessionToken) return null;
    return {
      matchPassengerId: String(payload.matchPassengerId),
      sessionToken: String(payload.sessionToken),
    };
  } catch {
    return null;
  }
}
