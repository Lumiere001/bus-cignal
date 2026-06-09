import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OPERATOR_COOKIE,
  OPERATOR_SESSION_DAYS,
  signOperatorToken,
} from "@/lib/auth/operator-session";

export const dynamic = "force-dynamic";

const SESSION_SEC = OPERATOR_SESSION_DAYS * 24 * 60 * 60; // operator-session 만료(30일)와 일치

/**
 * 간사 매직링크 입장 — /login/o/<token>.
 * 마스터가 발급·전달한 토큰을 검증하고 간사 세션 쿠키를 발급한다.
 * (CCC 본구현 전 임시 경로. login_token = operators 컬럼, revoke 시 null로 무효화됨.)
 * 토큰은 재사용 가능 → 방문할 때마다 새 12h 세션 발급(세션 만료 후 재입장 가능).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const base = req.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid", base));
  }

  const db = createAdminClient();
  const { data: op } = await db
    .from("operators")
    .select("id, ccc_id, region_id, approval_status")
    .eq("login_token", token)
    .maybeSingle();

  // 미존재·미승인·해제(revoke 시 token=null이라 매칭 자체가 안 됨)는 모두 거부.
  if (!op || op.approval_status !== "approved") {
    return NextResponse.redirect(new URL("/login?error=invalid", base));
  }

  const jwt = await signOperatorToken({
    operatorId: op.id,
    // 매직링크(임시) 간사는 아직 CCC 신원이 없을 수 있음 → 빈 문자열.
    cccId: op.ccc_id ?? "",
    regionId: op.region_id,
  });

  const res = NextResponse.redirect(new URL("/operator", base));
  res.cookies.set(OPERATOR_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SEC,
    path: "/",
  });
  return res;
}
