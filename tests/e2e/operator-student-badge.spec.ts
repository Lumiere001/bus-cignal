import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE } from "./support/auth-paths";
import { createStudentTrip, seedStudentRequest } from "./support/db";

// 승인 큐(공급 간사 화면)에서 학생 직접 신청이 '학생 직접 신청' 배지로 구분 표시되는지 — Phase 3-2.
//   광주(공급) 간사 세션. createStudentTrip은 광주 소유 trip이라 이 세션이 상세를 볼 수 있다.
test.use({ storageState: OPERATOR_GWANGJU_STATE });

test("승인 큐: 학생 직접 신청 → '학생 직접 신청' 배지 + 본인 정보 표시", async ({
  page,
}) => {
  const trip = await createStudentTrip();
  try {
    const { name } = await seedStudentRequest(trip.tripId, "queued");

    await page.goto(`/operator/trips/${trip.tripId}`);

    // 담당 간사 대신 학생 배지 + 학생 본인 이름이 큐에 노출
    await expect(page.getByText("학생 직접 신청")).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
  } finally {
    await trip.cleanup();
  }
});
