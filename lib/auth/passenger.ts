import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PASSENGER_COOKIE,
  verifyPassengerToken,
  type PassengerClaims,
} from "./passenger-session";

/**
 * Return passenger session claims from the bc_passenger_session cookie.
 * The cookie is issued after `/r/:code` reservation entry verification.
 */
export async function getPassengerSession(): Promise<PassengerClaims | null> {
  const c = await cookies();
  return verifyPassengerToken(c.get(PASSENGER_COOKIE)?.value);
}

/** Require a valid passenger session or redirect to the entry page. */
export async function requirePassenger(): Promise<PassengerClaims> {
  const session = await getPassengerSession();
  if (!session) redirect("/");
  return session;
}

/** Clear the passenger session cookie. */
export async function clearPassengerSession(): Promise<void> {
  const c = await cookies();
  c.delete(PASSENGER_COOKIE);
}
