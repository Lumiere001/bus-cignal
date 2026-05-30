import { test, expect } from "@playwright/test";

// DB 없이 동작하는 스모크(라우팅·렌더). 실데이터 시나리오 S1·S4·S5 + iOS PWA는 추후.
test("랜딩(/) 응답 OK", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
});

test("개인정보 처리방침(/privacy) 접근", async ({ page }) => {
  const res = await page.goto("/privacy");
  expect(res?.ok()).toBeTruthy();
});

test("간사 로그인(/login) 렌더", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("body")).toContainText(/로그인/);
});
