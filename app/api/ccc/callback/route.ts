import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/ccc/handoff";
import { provisionOperatorFromCcc } from "@/lib/ccc/provision";
import { OPERATOR_COOKIE, signOperatorToken } from "@/lib/auth/operator-session";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "bc_ccc_state";
const SESSION_SEC = 12 * 60 * 60; // operator-session(12h)와 일치

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

  // state는 항상 보내므로 항상 검증(쿠키와 일치).
  if (!state || !cookieState || state !== cookieState) return fail("state");

  // exchange는 발급 때와 동일한 redirect_uri를 보내야 함 = 등록된 콜백 URL.
  const redirectUri = `${base}/api/ccc/callback`;
  const ex = await exchangeCode(code, redirectUri);
  if (!ex.ok) return fail(ex.error.replace(/[^a-z_]/gi, ""));

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
