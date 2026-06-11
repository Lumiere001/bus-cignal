import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE } from "./support/auth-paths";
import { createApproveScenario } from "./support/db";

test.use({ storageState: OPERATOR_GWANGJU_STATE });

test("거절: 신청 전체 거절(사유 필수) → 큐에서 사라짐", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 2 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    // '신청 전체 거절'은 지구별(묶음) 뷰의 기능 — 기본 시간순 뷰에서 전환.
    await page.getByRole("button", { name: "지구별" }).click();
    await expect(page.getByText("E2E학생1")).toBeVisible();

    await page.getByRole("button", { name: "거절", exact: true }).click();
    await page.getByPlaceholder(/거절 사유/).fill("E2E 자동화 거절 사유 — 좌석 사정");
    // 학생 미선택 → 신청 전체 거절(경고 후 진행).
    await page.getByRole("button", { name: "신청 전체 거절" }).click();

    await expect(page.getByText("대기 중인 신청이 없습니다")).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});

test("선택 거절: 체크한 학생만 큐에서 빠지고 나머지는 대기 유지", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 2 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    await expect(page.getByText("E2E학생1")).toBeVisible();
    await expect(page.getByText("E2E학생2")).toBeVisible();

    // 학생1만 체크 → [거절] → 선택 거절([1명 거절]).
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "거절", exact: true }).click();
    await page.getByRole("button", { name: "1명 거절" }).click();

    // 학생1은 큐에서 사라지고, 학생2는 그대로 남아야 함(전체 삭제 아님).
    await expect(page.getByText("E2E학생1")).toHaveCount(0);
    await expect(page.getByText("E2E학생2")).toBeVisible();
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

test("정원(공개 좌석) 변경: 정원·잔여 함께 반영", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 1, offered: 10 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    // '정원' = 타지구 공개 좌석(=내놓는 좌석 10). 매칭 0 → 잔여 10.
    await expect(page.getByText("정원 10석", { exact: true })).toBeVisible();
    await expect(page.getByText("잔여 10석", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "정원(공개 좌석) 변경" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("spinbutton");
    await input.fill("6");
    await dialog.getByRole("button", { name: "변경 저장" }).click();
    await expect(dialog).toBeHidden(); // 저장 후 모달 닫힘

    // 공개 좌석 10→6: 정원(=공개 좌석) 6, 잔여 6(=6 − 매칭 0)으로 함께 반영.
    await expect(page.getByText("정원 6석", { exact: true })).toBeVisible();
    await expect(page.getByText("잔여 6석", { exact: true })).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});

test("정원(공개 좌석) 변경: 빈 값이면 저장 비활성 + 등록 최대 초과 거부", async ({ page }) => {
  const scn = await createApproveScenario({ passengers: 1, offered: 10 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    await page.getByRole("button", { name: "정원(공개 좌석) 변경" }).click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("spinbutton");
    const save = dialog.getByRole("button", { name: "변경 저장" });

    // 완전히 비우면 0이 자동 입력되지 않고 빈 상태 → 저장 비활성.
    await input.fill("");
    await expect(input).toHaveValue("");
    await expect(save).toBeDisabled();

    // 등록 최대(버스 정원 44) 초과 → 저장 비활성.
    await input.fill("99");
    await expect(save).toBeDisabled();

    // 유효 값 → 저장 활성.
    await input.fill("8");
    await expect(save).toBeEnabled();
  } finally {
    await scn.cleanup();
  }
});
