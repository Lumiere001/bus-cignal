import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import {
  cccBase,
  buildConsentUrl,
  CCC_STUDENT_CLIENT_ID,
} from "@/lib/ccc/handoff";

export const dynamic = "force-dynamic";

/** state(CSRF) 임시 보관 쿠키 — 콜백에서 일치 검증 후 즉시 삭제. */
const STATE_COOKIE = "bc_student_ccc_state";

/**
 * 학생 CCC 로그인 진입 — /s/login/ccc.
 * state 발급 → ccc-summer 학생 동의 화면으로 리다이렉트. (client_id=학생용 target_role=student)
 */
export async function GET(_req: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const url = buildConsentUrl(cccBase(), CCC_STUDENT_CLIENT_ID, state);

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
