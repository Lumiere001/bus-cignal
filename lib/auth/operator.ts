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
    // 차단은 redirect로만 한다. 쿠키 삭제(clearOperatorSession)는 호출하지 않는다 —
    // requireOperator는 서버 컴포넌트 렌더에서도 호출되는데, 렌더 컨텍스트에서 쿠키를
    // 변경하면 Next.js 16이 "Cookies can only be modified in a Server Action or
    // Route Handler" 예외를 던진다. 무상태 JWT 쿠키는 만료까지 남지만, 위 DB
    // 재확인이 매 요청 차단하므로 기능상 안전. 실제 쿠키 정리는 로그아웃 server
    // action(clearOperatorSession)에서 수행한다.
    redirect("/login");
  }
  return session;
}

/** 간사 로그아웃. */
export async function clearOperatorSession() {
  const c = await cookies();
  c.delete(OPERATOR_COOKIE);
}
