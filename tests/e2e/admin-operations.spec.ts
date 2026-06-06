import { test, expect } from "@playwright/test";
import { MASTER_STATE } from "./support/auth-paths";
import { createPendingOperator } from "./support/db";

test.use({ storageState: MASTER_STATE });

test("가입 승인: 대기 간사 승인 → 대기 목록에서 사라짐", async ({ page }) => {
  const op = await createPendingOperator();
  try {
    await page.goto("/admin/operators/pending");
    const row = page.getByRole("listitem").filter({ hasText: op.name });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "승인" }).click();

    // 승인 시 approved로 전이 → 대기 목록에서 제거
    await expect(page.getByText(op.name)).toHaveCount(0);
  } finally {
    await op.cleanup();
  }
});

test("정산 매트릭스: paid 매칭 반영(비어있지 않음)", async ({ page }) => {
  // seed의 paid 매칭(광주→부산, BUS-7K9M)이 항상 존재 → 매트릭스 데이터 렌더.
  await page.goto("/admin/settlement");
  await expect(
    page.getByRole("heading", { name: "전국 정산 매트릭스" }),
  ).toBeVisible();
  // 공급 지구(광주)가 매트릭스에 노출 = 빈 상태 아님
  await expect(page.getByText("광주").first()).toBeVisible();
});
