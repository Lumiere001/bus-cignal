import { NextResponse, type NextRequest } from "next/server";
import { isEligibleStaff } from "@/lib/ccc/handoff";
import { resolveLoginExchange } from "@/lib/ccc/resolve-login";
import { provisionOperatorFromCcc } from "@/lib/ccc/provision";
import { provisionStudentFromCcc } from "@/lib/ccc/student-provision";
import {
  OPERATOR_COOKIE,
  OPERATOR_SESSION_DAYS,
  signOperatorToken,
} from "@/lib/auth/operator-session";
import {
  STUDENT_COOKIE,
  STUDENT_SESSION_DAYS,
  signStudentToken,
} from "@/lib/auth/student-session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "bc_student_ccc_state";
const SESSION_SEC = STUDENT_SESSION_DAYS * 24 * 60 * 60;
const OPERATOR_SESSION_SEC = OPERATOR_SESSION_DAYS * 24 * 60 * 60;

/**
 * 학생 CCC 핸드오프 콜백 — /api/ccc/student-callback?code&state.
 *  state 검증 → 서버↔서버 exchange(학생 client) → 학생 프로비저닝 → 세션 발급 → /s.
 *
 * 간사/학생 분기(간사 요청 2026-06-11):
 *  - 간사용 client로 발급된 코드가 이 콜백에 도착하면 → 간사 client로 재교환.
 *    실제 간사면 간사 세션 → /operator, 간사 프로비저닝이 안 되면(지구 미등록 등)
 *    학생으로라도 입장시킨다.
 *  - 학생 client 코드는 기존 그대로: 간사여도 학생 신원으로 /s (학생 화면 접근 허용).
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
  // state(CSRF): 우리 버튼(/s/login/ccc)으로 시작했으면 쿠키가 있고 그땐 반드시 일치해야 함.
  //   CCC가 코드를 직접 전달(IdP-initiated)하면 쿠키가 없으니 검증 생략 — 한 번에 처리.
  if (cookieState && state !== cookieState) return fail("state");

  // 학생 client 먼저, 실패 시 간사 client로 재교환(간사 코드가 여기 도착하는 경우).
  const ex = await resolveLoginExchange(code, base, "student");
  if (!ex.ok) return fail(ex.error.replace(/[^a-z_]/gi, ""));

  // 간사용 client 코드 + 실제 간사 → 간사 로그인으로 작동.
  if (ex.intent === "staff" && isEligibleStaff(ex.payload)) {
    const oprov = await provisionOperatorFromCcc(ex.subjectId, ex.payload);
    if (oprov.ok) {
      const ojwt = await signOperatorToken({
        operatorId: oprov.operatorId,
        cccId: oprov.cccId,
        regionId: oprov.regionId,
      });
      const ores = NextResponse.redirect(new URL("/operator", base));
      ores.cookies.set(OPERATOR_COOKIE, ojwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: OPERATOR_SESSION_SEC,
        path: "/",
      });
      ores.cookies.delete(STATE_COOKIE);
      return ores;
    }
    // 지구 미등록·revoked 등 — 간사 입장은 못 해도 학생으로는 들여보낸다(아래 계속).
  }

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
