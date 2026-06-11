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

const STATE_COOKIE = "bc_ccc_state";
const SESSION_SEC = OPERATOR_SESSION_DAYS * 24 * 60 * 60; // operator-session(30일)와 일치
const STUDENT_SESSION_SEC = STUDENT_SESSION_DAYS * 24 * 60 * 60;

/**
 * CCC 핸드오프 콜백 — /api/ccc/callback?code&state.
 *  1) state(CSRF) 검증  2) 서버↔서버 exchange로 payload 수신
 *  3) 간사 프로비저닝(자동 승인·지구 매핑)  4) 간사 세션 발급 → /operator
 *
 * 간사/학생 분기(간사 요청 2026-06-11 — 학생 QR로 들어와도 학생 로그인으로 작동):
 *  - CCC가 "간사 아님" 오류를 돌려주면 → /s/login/ccc 로 자동 재시작
 *    (CCC에는 이미 로그인된 상태라 학생 동의 한 번으로 바로 /s 입장).
 *  - 학생용 client로 발급된 코드가 이 콜백에 도착하면 → 학생 client로 재교환해
 *    학생 세션 발급 → /s.
 *  - 간사 코드인데 payload가 학생(is_staff=false)이면 → 학생 프로비저닝 → /s (기존).
 * 실패는 모두 /login?error=ccc_<reason> 으로 친절히 안내(상세/시크릿 비노출).
 */
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const upstreamError = sp.get("error");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=ccc_${reason}`, base));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const studentSession = async (prov: {
    studentId: string;
    cccId: string;
    regionId: string | null;
  }) => {
    const sjwt = await signStudentToken({
      studentId: prov.studentId,
      cccId: prov.cccId,
      regionId: prov.regionId,
    });
    const sres = NextResponse.redirect(new URL("/s", base));
    sres.cookies.set(STUDENT_COOKIE, sjwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STUDENT_SESSION_SEC,
      path: "/",
    });
    sres.cookies.delete(STATE_COOKIE);
    return sres;
  };

  // ccc-summer가 거부/오류를 넘긴 경우(access_denied, not-staff 등)
  if (upstreamError) {
    const clean = upstreamError.replace(/[^a-z_]/gi, "");
    // "간사 아님" 계열(not_staff·not-staff 등) = 학생이 간사 입구로 들어온 것 →
    // 오류 화면 대신 학생 CCC 로그인으로 자동 재시작.
    if (/staff/i.test(clean)) {
      const res = NextResponse.redirect(new URL("/s/login/ccc", base));
      res.cookies.delete(STATE_COOKIE);
      return res;
    }
    return fail(clean);
  }
  if (!code) return fail("no_code");

  // state(CSRF): 우리 로그인 버튼(/login/ccc)으로 시작한 흐름엔 쿠키가 있고, 그땐 반드시 일치해야 한다.
  // 단, CCC가 코드를 콜백으로 **직접 전달**(IdP-initiated)하는 경우엔 우리 쿠키가 없으므로 검증을 건너뛴다
  //   — 코드를 다시 로그인 누르지 않고 한 번에 처리(간사 요청). 핸드오프 보안은 1회용 5분 code +
  //   등록된 redirect_uri + 서버↔서버 exchange로도 성립하므로 안전 표면은 유지된다.
  if (cookieState && state !== cookieState) return fail("state");

  // 간사 client 먼저, 실패 시 학생 client로 재교환(학생 QR 코드가 여기 도착하는 경우).
  const ex = await resolveLoginExchange(code, base, "staff");
  if (!ex.ok) return fail(ex.error.replace(/[^a-z_]/gi, ""));

  // 학생용 client 코드 → 학생 로그인으로 작동.
  if (ex.intent === "student") {
    const sprov = await provisionStudentFromCcc(ex.subjectId, ex.payload);
    if (!sprov.ok) return fail(sprov.error);
    return studentSession(sprov);
  }

  // 간사 코드인데 학생 신원(is_staff=false) → 학생으로 우회(기존 동작).
  if (!isEligibleStaff(ex.payload)) {
    const sprov = await provisionStudentFromCcc(ex.subjectId, ex.payload);
    if (sprov.ok) return studentSession(sprov);
    return fail("not_staff");
  }

  const prov = await provisionOperatorFromCcc(ex.subjectId, ex.payload);
  if (!prov.ok) return fail(prov.error);

  const jwt = await signOperatorToken({
    operatorId: prov.operatorId,
    cccId: prov.cccId,
    regionId: prov.regionId,
  });

  const res = NextResponse.redirect(new URL("/operator", base));
  res.cookies.set(OPERATOR_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SEC,
    path: "/",
  });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
