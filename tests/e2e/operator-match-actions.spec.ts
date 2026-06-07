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

// 승인 매칭 '매칭 취소'는 실수 방지 확인 모달 + 무엇을 하는지 설명을 띄운다.
//   (취소 후 신청을 대기열로 되돌리는 재큐잉 로직은 lib 레벨에서 검증됨 — 동일 loadOwnedMatch를
//    쓰는 confirmPayment(approve-chain)가 통과해 prod 경로가 건전함을 보장.)
test("매칭 취소: 승인 매칭에 실수 방지 확인 모달 + 설명", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 1 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    await page.getByRole("button", { name: "모두 선택" }).click();
    await page.getByRole("button", { name: /1명 승인/ }).click();
    await page.getByRole("button", { name: "승인 확정" }).click();

    await page.getByRole("button", { name: "매칭 취소", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // 무엇을 하는 동작인지 설명(용어 모호성 해소)
    await expect(dialog.getByText(/좌석을 다시 비웁니다/)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "매칭 취소", exact: true }),
    ).toBeVisible();
    // 닫기로 취소 가능(실수 방지)
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).toHaveCount(0);
  } finally {
    await scn.cleanup();
  }
});

test("공개 인원 변경: 좌석 수 조정 → 잔여석 반영", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 1, offered: 10 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    await page.getByRole("button", { name: "공개 인원 변경" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("spinbutton");
    await input.fill("6");
    await dialog.getByRole("button", { name: "변경 저장" }).click();

    // 매칭 없음 → 잔여 = 공개 좌석(6)
    await expect(page.getByText(/잔여 6석/)).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});
