import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/ccc/handoff";
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

  // ccc-summer가 거부/오류를 넘긴 경우(access_denied, not-staff 등)
  if (upstreamError) return fail(upstreamError.replace(/[^a-z_]/gi, ""));
  if (!code) return fail("no_code");

  // state(CSRF): 우리 로그인 버튼(/login/ccc)으로 시작한 흐름엔 쿠키가 있고, 그땐 반드시 일치해야 한다.
  // 단, CCC가 코드를 콜백으로 **직접 전달**(IdP-initiated)하는 경우엔 우리 쿠키가 없으므로 검증을 건너뛴다
  //   — 코드를 다시 로그인 누르지 않고 한 번에 처리(간사 요청). 핸드오프 보안은 1회용 5분 code +
  //   등록된 redirect_uri + 서버↔서버 exchange로도 성립하므로 안전 표면은 유지된다.
  if (cookieState && state !== cookieState) return fail("state");

  // exchange는 발급 때와 동일한 redirect_uri를 보내야 함 = 등록된 콜백 URL.
  const redirectUri = `${base}/api/ccc/callback`;
  const ex = await exchangeCode(code, redirectUri);
  if (!ex.ok) return fail(ex.error.replace(/[^a-z_]/gi, ""));

  const prov = await provisionOperatorFromCcc(ex.subjectId, ex.payload);
  if (!prov.ok) {
    // 간사 계정이 아니면(학생) → 학생으로 프로비저닝 후 학생 허브(/s)로 우회.
    //   학생이 실수로 '간사 로그인'으로 들어와도 오류 대신 본인 화면으로 가게 한다.
    //   (CCC가 payload를 돌려준 경우. is_staff=false라 student-provision은 그대로 통과.)
    if (prov.error === "not_staff") {
      const sprov = await provisionStudentFromCcc(ex.subjectId, ex.payload);
      if (sprov.ok) {
        const sjwt = await signStudentToken({
          studentId: sprov.studentId,
          cccId: sprov.cccId,
          regionId: sprov.regionId,
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
      }
    }
    return fail(prov.error);
  }

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
