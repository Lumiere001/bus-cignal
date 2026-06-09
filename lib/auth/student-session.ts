import { SignJWT, jwtVerify } from "jose";

// ⚠️ edge(미들웨어) 호환 — server-only 의존 금지 (jose만).
// 학생(student) 세션: CCC 로그인 신원을 검증한 뒤 자체 발급(operator/passenger와 동일 패턴).
const ALG = "HS256";
export const STUDENT_COOKIE = "bc_student_session";
export const STUDENT_SESSION_DAYS = 30;

export type StudentClaims = {
  studentId: string;
  cccId: string;
  /** 출신 지구(없으면 null — 신청 시 필요). */
  regionId: string | null;
};

function secret(): Uint8Array {
  const value = process.env.STUDENT_SESSION_SECRET;
  if (!value) {
    throw new Error("STUDENT_SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  }
  return new TextEncoder().encode(value);
}

/** 학생 세션 JWT 발급 (30일). CCC 로그인 검증 후에만 호출. */
export async function signStudentToken(claims: StudentClaims): Promise<string> {
  return new SignJWT({ role: "student", ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_SESSION_DAYS}d`)
    .sign(secret());
}

/** 학생 세션 토큰 검증 → claims. 실패 시 null. */
export async function verifyStudentToken(
  token: string | undefined,
): Promise<StudentClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "student") return null;
    return {
      studentId: String(payload.studentId),
      cccId: String(payload.cccId),
      regionId: (payload.regionId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
