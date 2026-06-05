import { test, expect } from "@playwright/test";
import { MASTER_STATE } from "./support/auth-paths";
import { db } from "./support/db";

// 마스터 세션으로 실행.
test.use({ storageState: MASTER_STATE });

test("마스터 간사 온보딩: 간사 추가 → 입장 링크(매직링크) 발급", async ({ page }) => {
  // 고유 이름 (밀리초) → 격리·정리 용이. (테스트 파일이므로 Date.now 사용 가능)
  const name = `E2E온보딩${Date.now().toString().slice(-7)}`;
  try {
    await page.goto("/admin/operators");
    await expect(
      page.getByRole("heading", { name: "간사 권한 관리" }),
    ).toBeVisible();

    await page.fill("#op-name", name);
    await page.selectOption("#op-region", { index: 1 }); // 「선택」 다음 첫 실제 지구
    await page.getByRole("button", { name: "간사 추가" }).click();

    // 추가된 간사 행 + 입장 링크(/login/o/<token>)·복사 버튼 등장 = 온보딩 완료
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText(/\/login\/o\//)).toBeVisible();
    await expect(row.getByRole("button", { name: "링크 복사" })).toBeVisible();
  } finally {
    await db.from("operators").delete().eq("name", name);
  }
});
