import "server-only";
import { randomBytes } from "crypto";

// 간사 매직링크 토큰 — CCC 본구현 전 임시 로그인.
// 256비트 무작위(URL-safe). 마스터 승인/재발급 시 생성, operators.login_token에 저장.
// 입장 경로: /login/o/<token> (app/login/o/[token]/route.ts).
export function generateLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

/** 입장 링크 경로(상대). 절대 URL은 호출부에서 origin을 붙인다. */
export function operatorLoginPath(token: string): string {
  return `/login/o/${token}`;
}
