import { SignJWT, jwtVerify } from "jose";

// ⚠️ edge(미들웨어) 호환 — server-only 의존 금지 (jose만).
const ALG = "HS256";
export const MASTER_COOKIE = "bc_master_session";

function secret() {
  return new TextEncoder().encode(process.env.MASTER_SESSION_SECRET!);
}

/** 마스터 세션 JWT 발급 (24h). */
export async function signMasterToken(): Promise<string> {
  return new SignJWT({ role: "master" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
}

/** 마스터 세션 토큰 검증 (미들웨어·서버 공용). */
export async function verifyMasterToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "master";
  } catch {
    return false;
  }
}
