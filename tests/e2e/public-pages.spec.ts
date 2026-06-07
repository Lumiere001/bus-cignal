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

  // 예약 조회 입구(/r): 과거 404였던 버그 회귀 방지 — 번호 입력 → 본인확인 페이지(/r/<code>)로 이동.
  test("예약 조회 입구(/r): 번호 입력 → 본인확인 페이지", async ({ page }) => {
    const res = await page.goto("/r");
    expect(res?.ok()).toBeTruthy(); // 200 (이전 회귀: 404)
    await expect(page.getByRole("heading", { name: "예약 조회" })).toBeVisible();

    // 소문자·접두어 없이 입력해도 BUS-XXXX로 정규화되어 본인확인 페이지로.
    await page.getByLabel("예약번호").fill("ab2c");
    await page.getByRole("button", { name: "조회하기" }).click();

    await expect(page).toHaveURL(/\/r\/BUS-AB2C$/);
    await expect(page.getByRole("button", { name: "본인 확인" })).toBeVisible();
  });
});
