import { SignJWT, jwtVerify } from "jose";

// ⚠️ edge(미들웨어) 호환 — server-only 의존 금지 (jose만).
// 학생(passenger) 세션: 예약번호(BUS-XXXX) + 이름 + 전화 끝 4자리 검증 후 자체 발급.
// operator·master 세션과 동일 패턴. SPEC §3.S5 (세션 30일 = 자동로그인 편의).
const ALG = "HS256";
export const PASSENGER_COOKIE = "bc_passenger_session";
export const PASSENGER_SESSION_DAYS = 30;

export type PassengerClaims = {
  /** 인증에 사용된 match_passengers.id — "이 학생이 누구인지"의 앵커. */
  passengerId: string;
};

function secret(): Uint8Array {
  // 키 미설정 시 조용히 깨지지 말고 즉시 명확히 실패 (운영 오설정 빠르게 감지)
  const value = process.env.PASSENGER_SESSION_SECRET;
  if (!value) {
    throw new Error("PASSENGER_SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return new TextEncoder().encode(value);
}

/** 학생 세션 JWT 발급 (30일). 예약번호+이름+전화 검증 통과 후 호출. */
export async function signPassengerToken(
  claims: PassengerClaims,
): Promise<string> {
  return new SignJWT({ role: "passenger", ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${PASSENGER_SESSION_DAYS}d`)
    .sign(secret());
}

/** 학생 세션 토큰 검증 → claims (미들웨어·서버 공용). 실패 시 null. */
export async function verifyPassengerToken(
  token: string | undefined,
): Promise<PassengerClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    // role 체크 — operator·master 토큰으로 학생 위장 차단
    if (payload.role !== "passenger") return null;
    return { passengerId: String(payload.passengerId) };
  } catch {
    return null;
  }
}
