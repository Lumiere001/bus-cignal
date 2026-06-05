import { expect, test } from "@playwright/test";
import { E2E_MASTER_PASSWORD } from "./master-auth.fixtures";

// 마스터 비번 인증 흐름 — SPEC §2.1·§8 (5회 실패 1h 잠금, 세션 24h).
// dev 서버는 playwright.config가 주입한 E2E_MASTER_PASSWORD 해시로만 로그인됨.
test.describe.serial("마스터 로그인", () => {
  test("미인증 /admin → /admin/login 리다이렉트 (미들웨어 가드)", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator("h1")).toContainText("마스터 로그인");
  });

  test("틀린 비번 → 오류 + 남은 횟수 표시", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[name="password"]', "definitely-wrong-password");
    // 로그인 페이지는 admin 레이아웃(상단 nav)에 중첩돼 '로그아웃' 버튼도 존재 →
    // 버튼명으로 로그인 폼 제출만 정확히 클릭(submit 셀렉터는 모호).
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/error=invalid/);
    await expect(page.locator("body")).toContainText(
      "비밀번호가 올바르지 않습니다",
    );
    await expect(page.locator("body")).toContainText("회 남음");
  });

  test("올바른 비번 → /admin 진입 (세션 발급 + 가드 통과)", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[name="password"]', E2E_MASTER_PASSWORD);
    // 로그인 페이지는 admin 레이아웃(상단 nav)에 중첩돼 '로그아웃' 버튼도 존재 →
    // 버튼명으로 로그인 폼 제출만 정확히 클릭(submit 셀렉터는 모호).
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    // 미들웨어 가드를 통과해 /admin 도달 = 세션 쿠키 정상 발급·검증
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator("body")).toContainText("전국 대시보드");
  });
});
