/**
 * E2E 전용 cron 토큰 — **시크릿 아님.** 로컬·CI 테스트에서만 사용.
 * global-setup이 .env.development.local에 주입(최우선) → dev 서버가 이 값으로만 cron 인증.
 * (운영 .env.local의 실제 CRON_SECRET과 무관.)
 *
 * ※ 파일명에 'secret'을 쓰지 않는다 — .gitignore의 `*secret*` 규칙에 걸려 커밋이 누락됨.
 */
export const E2E_CRON_SECRET = "e2e-cron-token-DO-NOT-USE-IN-PROD";
