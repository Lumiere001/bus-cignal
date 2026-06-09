import { SignJWT, jwtVerify } from "jose";

// ⚠️ edge(미들웨어) 호환 — server-only 의존 금지 (jose만).
// 간사(operator) 세션: CCC 로그인 신원을 검증한 뒤 우리가 자체 발급한다.
// (Supabase Auth/Google OAuth 미사용 — 마스터 세션과 동일 패턴)
const ALG = "HS256";
export const OPERATOR_COOKIE = "bc_operator_session";
// 간사 세션 수명 — 수련회 기간 동안 재로그인 최소화(특히 iOS PWA는 1회 로그인 후 유지).
export const OPERATOR_SESSION_DAYS = 30;

export type OperatorClaims = {
  operatorId: string;
  cccId: string;
  regionId: string | null;
};

function secret(): Uint8Array {
  // 키 미설정 시 조용히 깨지지 말고 즉시 명확히 실패 (운영 오설정 빠르게 감지)
  // — 미설정이면 jose가 "Zero-length key is not supported"라는 모호한 에러를 던짐.
  const value = process.env.OPERATOR_SESSION_SECRET;
  if (!value) {
    throw new Error("OPERATOR_SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return new TextEncoder().encode(value);
}

/** 간사 세션 JWT 발급 (30일). 마스터 승인 완료된 operator에 대해서만 호출. */
export async function signOperatorToken(claims: OperatorClaims): Promise<string> {
  return new SignJWT({ role: "operator", ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${OPERATOR_SESSION_DAYS}d`)
    .sign(secret());
}

/** 간사 세션 토큰 검증 → claims (미들웨어·서버 공용). 실패 시 null. */
export async function verifyOperatorToken(
  token: string | undefined,
): Promise<OperatorClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "operator") return null;
    return {
      operatorId: String(payload.operatorId),
      cccId: String(payload.cccId),
      regionId: (payload.regionId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
