import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, CCC_STUDENT_CLIENT_ID } from "@/lib/ccc/handoff";
import { provisionStudentFromCcc } from "@/lib/ccc/student-provision";
import {
  STUDENT_COOKIE,
  STUDENT_SESSION_DAYS,
  signStudentToken,
} from "@/lib/auth/student-session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "bc_student_ccc_state";
const SESSION_SEC = STUDENT_SESSION_DAYS * 24 * 60 * 60;

/**
 * 학생 CCC 핸드오프 콜백 — /api/ccc/student-callback?code&state.
 *  state 검증 → 서버↔서버 exchange(학생 client) → 학생 프로비저닝 → 세션 발급 → /s.
 * 실패는 /s/login?error=ccc_<reason> 으로 안내(상세/시크릿 비노출).
 */
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const upstreamError = sp.get("error");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(
      new URL(`/s/login?error=ccc_${reason}`, base),
    );
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  if (upstreamError) return fail(upstreamError.replace(/[^a-z_]/gi, ""));
  if (!code) return fail("no_code");
  if (!state || !cookieState || state !== cookieState) return fail("state");

  const redirectUri = `${base}/api/ccc/student-callback`;
  const ex = await exchangeCode(code, redirectUri, CCC_STUDENT_CLIENT_ID);
  if (!ex.ok) return fail(ex.error.replace(/[^a-z_]/gi, ""));

  const prov = await provisionStudentFromCcc(ex.subjectId, ex.payload);
  if (!prov.ok) return fail(prov.error);

  const jwt = await signStudentToken({
    studentId: prov.studentId,
    cccId: prov.cccId,
    regionId: prov.regionId,
  });

  const res = NextResponse.redirect(new URL("/s", base));
  res.cookies.set(STUDENT_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SEC,
    path: "/",
  });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
