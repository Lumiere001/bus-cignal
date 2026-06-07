import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE } from "./support/auth-paths";
import { db, createApproveScenario, createPaidMatchScenario } from "./support/db";

// 공급 간사(광주)의 차량 취소 회귀 방지. app/operator/trips/[id]/{TripCancelButton, actions.cancelTrip}.
//   - 활성 매칭이 없을 때만 취소 가능 → cancelled + 좌석 마감 + 대기 신청 취소.
//   - 활성 매칭(paid)이 있으면 버튼 비활성(사유 표시).
// 격리: 각 테스트 독립 시나리오 + finally cleanup. 단언은 상태 전이 위주.
test.use({ storageState: OPERATOR_GWANGJU_STATE });

test("공개 차량(매칭 없음) → 차량 취소 확정 → cancelled + 대기 신청 취소", async ({
  page,
}) => {
  const scn = await createApproveScenario({ passengers: 2 });
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);

    const cancelBtn = page.getByRole("button", { name: "차량 취소", exact: true });
    await expect(cancelBtn).toBeEnabled();
    await cancelBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder("취소 사유 (선택)").fill("E2E — 인원 미달로 취소");
    await dialog.getByRole("button", { name: "차량 취소 확정" }).click();

    // 성공 → 차량 목록으로 이동.
    await expect(page).toHaveURL(/\/operator\/trips$/);

    // DB 확인: trip cancelled + 대기(queued)였던 신청도 cancelled.
    const { data: trip } = await db
      .from("trips")
      .select("status")
      .eq("id", scn.tripId)
      .single();
    expect(trip?.status).toBe("cancelled");
    const { data: req } = await db
      .from("seat_requests")
      .select("status")
      .eq("id", scn.requestId)
      .single();
    expect(req?.status).toBe("cancelled");
  } finally {
    await scn.cleanup();
  }
});

test("활성 매칭(paid)이 있으면 차량 취소 버튼 비활성 + 사유 표시", async ({
  page,
}) => {
  const scn = await createPaidMatchScenario();
  try {
    await page.goto(`/operator/trips/${scn.tripId}`);
    const cancelBtn = page.getByRole("button", { name: "차량 취소", exact: true });
    await expect(cancelBtn).toBeDisabled();
    await expect(
      page.getByText(/매칭된 학생이 있어 취소할 수 없어요/),
    ).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});
