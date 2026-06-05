import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OPERATOR_COOKIE,
  verifyOperatorToken,
  type OperatorClaims,
} from "./operator-session";

/**
 * 간사(operator) 세션 claims 반환 (없으면 null). 서버 컴포넌트·액션 공용.
 * CCC 로그인(또는 dev 로그인)으로 발급된 `bc_operator_session` 쿠키를 검증.
 */
export async function getOperatorSession(): Promise<OperatorClaims | null> {
  const c = await cookies();
  return verifyOperatorToken(c.get(OPERATOR_COOKIE)?.value);
}

/**
 * 간사 세션 필수 — 없으면 `/login`으로 redirect. 보호된 operator 페이지에서 호출.
 * 세션은 무상태 12h JWT라, 마스터가 권한 해제(revoke)해도 토큰은 만료까지 유효.
 * → 매 요청 DB의 `approval_status`를 재확인해 revoke/미승인 간사를 즉시 차단(SPEC §5.10 "즉시 회수").
 */
export async function requireOperator(): Promise<OperatorClaims> {
  const session = await getOperatorSession();
  if (!session) redirect("/login");

  const db = createAdminClient();
  const { data } = await db
    .from("operators")
    .select("approval_status")
    .eq("id", session.operatorId)
    .maybeSingle();
  if (data?.approval_status !== "approved") {
    await clearOperatorSession();
    redirect("/login");
  }
  return session;
}

/** 간사 로그아웃. */
export async function clearOperatorSession() {
  const c = await cookies();
  c.delete(OPERATOR_COOKIE);
}
