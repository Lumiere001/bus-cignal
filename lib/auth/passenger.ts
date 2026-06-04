import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PASSENGER_COOKIE,
  PASSENGER_SESSION_DAYS,
  signPassengerToken,
  verifyPassengerToken,
  type PassengerClaims,
} from "./passenger-session";

/**
 * 학생(passenger) 세션 헬퍼 — 팀원2의 학생 페이지(app/me 등)에서 호출.
 * operator.ts(requireOperator)와 동일한 사용 패턴.
 */

/** 학생 세션 claims (없으면 null). 서버 컴포넌트·액션 공용. */
export async function getPassengerSession(): Promise<PassengerClaims | null> {
  const c = await cookies();
  return verifyPassengerToken(c.get(PASSENGER_COOKIE)?.value);
}

/**
 * 학생 세션 필수 — 없으면 진입점으로 redirect. 보호된 학생 페이지(/me 등)에서 호출.
 * (redirect 대상은 학생 진입 UX 확정되면 팀원2가 조정 가능 — 현재는 랜딩 "/")
 */
export async function requirePassenger(): Promise<PassengerClaims> {
  const session = await getPassengerSession();
  if (!session) redirect("/");
  return session;
}

/**
 * 학생 세션 발급 — /r/[code] 인증 액션에서 예약번호+이름+전화끝4자리 검증
 * (match_passengers.access_token_hash 비교) **통과 후** 호출.
 * @param passengerId 검증된 match_passengers.id
 */
export async function issuePassengerSession(passengerId: string) {
  const token = await signPassengerToken({ passengerId });
  const c = await cookies();
  c.set(PASSENGER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PASSENGER_SESSION_DAYS * 24 * 60 * 60,
  });
}

/** 학생 로그아웃. */
export async function clearPassengerSession() {
  const c = await cookies();
  c.delete(PASSENGER_COOKIE);
}
