/**
 * E2E 전용 마스터 비밀번호 — **시크릿 아님**. 로컬·CI 테스트에서만 사용.
 * playwright.config.ts가 이 비번의 bcrypt 해시를 dev 서버 MASTER_PASSWORD_HASH로 주입한다.
 * 따라서 실제 .env.local·운영 해시와 완전히 무관 (E2E 서버는 이 비번으로만 로그인됨).
 */
export const E2E_MASTER_PASSWORD = "e2e-master-pw-DO-NOT-USE-IN-PROD";
