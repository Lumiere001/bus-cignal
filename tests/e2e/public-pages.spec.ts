import { test, expect } from "@playwright/test";

// 세션 없는 공개 페이지 렌더(스모크 확장) — 라우팅·SSR 회귀 방지.
test.describe("공개 페이지", () => {
  test("간사 가입(/signup) 응답 OK", async ({ page }) => {
    const res = await page.goto("/signup");
    expect(res?.ok()).toBeTruthy();
  });

  test("마스터 승인 대기(/pending)", async ({ page }) => {
    await page.goto("/pending");
    await expect(page.getByText("마스터 승인 대기")).toBeVisible();
  });

  test("이용약관(/terms) 응답 OK", async ({ page }) => {
    const res = await page.goto("/terms");
    expect(res?.ok()).toBeTruthy();
  });

  test("오프라인(/offline) 응답 OK", async ({ page }) => {
    const res = await page.goto("/offline");
    expect(res?.ok()).toBeTruthy();
  });
});
