import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE } from "./support/auth-paths";
import { createApproveScenario, type ApproveScenario } from "./support/db";

// 광주(공급) 간사 세션으로 실행 (storageState 재사용).
test.use({ storageState: OPERATOR_GWANGJU_STATE });

// 격리 시나리오: 광주 소유 published trip + 부산 큐 신청(학생 2명) — 매 실행마다 새 ID.
let scn: ApproveScenario;
test.beforeAll(async () => {
  scn = await createApproveScenario({ passengers: 2 });
});
test.afterAll(async () => {
  await scn?.cleanup();
});

test("간사 승인 사슬: 대기 큐 → 원자 승인(B3) → 입금 확인 → 예약번호 발급", async ({
  page,
}) => {
  await page.goto(`/operator/trips/${scn.tripId}`);

  // 대기 신청에 격리 시나리오 학생이 노출(큐 표시)
  await expect(page.getByRole("heading", { name: "대기 신청" })).toBeVisible();
  await expect(page.getByText("E2E학생1")).toBeVisible();
  await expect(page.getByText("E2E학생2")).toBeVisible();

  // 모두 선택 → "2명 승인" → 안내 모달(K1) → 승인 확정 (approve_request_atomic RPC = B3)
  await page.getByRole("button", { name: "모두 선택" }).click();
  await page.getByRole("button", { name: /2명 승인/ }).click();
  await expect(
    page.getByText(/입금 확정 후에는 공급 지구/),
  ).toBeVisible(); // 모달 경고문
  await page.getByRole("button", { name: "승인 확정" }).click();

  // 매칭 현황에 입금 확인 버튼 등장 → 클릭 → paid + 예약번호 발급
  const confirm = page.getByRole("button", { name: "입금 확인" }).first();
  await expect(confirm).toBeVisible();
  await confirm.click();

  await expect(page.getByText(/예약번호\s+\S+/)).toBeVisible();
});
