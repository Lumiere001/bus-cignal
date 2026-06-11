import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE, STUDENT_STATE } from "./support/auth-paths";

// 랜딩(/) QR 재방문 분기(간사 보고 2026-06-11) — 이미 로그인된 사용자는
// 랜딩에 멈추지 않고 본인 화면으로 바로. 로그인 페이지도 재로그인 불필요.

test.describe("랜딩 세션 분기 — 학생", () => {
  test.use({ storageState: STUDENT_STATE });

  test("/ → 학생 허브(/s)로 자동 이동", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/s");
    await expect(page).toHaveURL(/\/s$/);
  });

  test("/s/login → 이미 로그인이라 /s로", async ({ page }) => {
    await page.goto("/s/login");
    await page.waitForURL("**/s");
    await expect(page).toHaveURL(/\/s$/);
  });
});

test.describe("랜딩 세션 분기 — 간사", () => {
  test.use({ storageState: OPERATOR_GWANGJU_STATE });

  test("/ → 간사 화면(/operator)으로 자동 이동", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/operator**");
    expect(page.url()).toContain("/operator");
  });

  test("/login → 이미 로그인이라 /operator로", async ({ page }) => {
    await page.goto("/login");
    await page.waitForURL("**/operator**");
    expect(page.url()).toContain("/operator");
  });
});

test.describe("랜딩 세션 분기 — 비로그인(회귀)", () => {
  test("/ 는 랜딩을 그대로 보여준다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /간사 로그인/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /학생 로그인/ })).toBeVisible();
  });
});
