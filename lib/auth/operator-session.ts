import { SignJWT, jwtVerify } from "jose";

// ⚠️ edge(미들웨어) 호환 — server-only 의존 금지 (jose만).
// 간사(operator) 세션: CCC 로그인 신원을 검증한 뒤 우리가 자체 발급한다.
// (Supabase Auth/Google OAuth 미사용 — 마스터 세션과 동일 패턴)
const ALG = "HS256";
export const OPERATOR_COOKIE = "bc_operator_session";

export type OperatorClaims = {
  operatorId: string;
  cccId: string;
  regionId: string | null;
};

function secret() {
  return new TextEncoder().encode(process.env.OPERATOR_SESSION_SECRET!);
}

/** 간사 세션 JWT 발급 (12h). 마스터 승인 완료된 operator에 대해서만 호출. */
export async function signOperatorToken(claims: OperatorClaims): Promise<string> {
  return new SignJWT({ role: "operator", ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("12h")
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
