import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE } from "./support/auth-paths";
import { createApproveScenario } from "./support/db";

test.use({ storageState: OPERATOR_GWANGJU_STATE });

test("거절: 신청 전체 거절(사유 필수) → 큐에서 사라짐", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 2 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    await expect(page.getByText("E2E학생1")).toBeVisible();

    await page.getByRole("button", { name: "거절", exact: true }).click();
    await page.getByPlaceholder(/거절 사유/).fill("E2E 자동화 거절 사유 — 좌석 사정");
    await page.getByRole("button", { name: "거절 확정" }).click();

    await expect(page.getByText("대기 중인 신청이 없습니다")).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});

test("자리 풀기: 승인 매칭 수동 해제 → 입금 확인 버튼 사라짐", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 1 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    await page.getByRole("button", { name: "모두 선택" }).click();
    await page.getByRole("button", { name: /1명 승인/ }).click();
    await page.getByRole("button", { name: "승인 확정" }).click();

    const release = page.getByRole("button", { name: "자리 풀기" }).first();
    await expect(release).toBeVisible();
    await release.click();

    // 해제(expired) 후 매칭에 액션 없음 → "입금 확인" 0개
    await expect(page.getByRole("button", { name: "입금 확인" })).toHaveCount(0);
  } finally {
    await scn.cleanup();
  }
});
