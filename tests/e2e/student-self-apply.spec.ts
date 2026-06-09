import { test, expect } from "@playwright/test";
import { STUDENT_STATE } from "./support/auth-paths";
import {
  createStudentTrip,
  createStudentPaidScenario,
  type StudentTripScenario,
  type StudentPaidScenario,
} from "./support/db";

// CCC 학생 직접 신청(Phase 2·3) — 학생 세션(최학생, 부산)으로 검증.
//   ⚠️ 로컬엔 Firebase Admin/키가 없어 채팅 client는 "준비 중"을 표시 → 채팅은
//      "서버 렌더 헤더/접근 판정"만 검증(접근 경계가 핵심, chat-access.spec과 동일 방식).
test.use({ storageState: STUDENT_STATE });

test("학생 직접 신청 → /s 내 신청에 '대기중' 표시", async ({ page }) => {
  const trip: StudentTripScenario = await createStudentTrip();
  try {
    await page.goto("/s/apply");

    // 격리 차량 카드(고유 라벨) 클릭 → 신청 확인 모달
    await page.getByRole("button", { name: trip.destLabel }).click();

    // 본인 정보 미리채움 확인 + 개인정보 동의 → 신청
    await expect(page.getByText("최학생")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "신청하기" }).click();

    // /s 로 redirect → 방금 신청이 '대기중'으로 보임
    await page.waitForURL(/\/s$/);
    await expect(page.getByText("대기중")).toBeVisible();
    await expect(page.getByText(trip.destLabel)).toBeVisible();
  } finally {
    await trip.cleanup();
  }
});

test("학생 중복 신청 차단 — 같은 차량 재신청 시 서버 가드가 막는다", async ({
  page,
}) => {
  const trip: StudentTripScenario = await createStudentTrip();
  try {
    // 1차 신청 → /s 로 redirect
    await page.goto("/s/apply");
    await page.getByRole("button", { name: trip.destLabel }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "신청하기" }).click();
    await page.waitForURL(/\/s$/);
    await expect(page.getByText("대기중")).toBeVisible();

    // 2차 신청 시도(같은 차량) — queued 신청은 잔여를 줄이지 않아 카드가 그대로 보임.
    // 서버 중복 가드(createStudentRequest)가 막고 모달에 안내가 떠야 한다(redirect 안 됨).
    await page.goto("/s/apply");
    await page.getByRole("button", { name: trip.destLabel }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "신청하기" }).click();
    await expect(page.getByText(/이미 신청한 차량/)).toBeVisible();

    // 중복이 저장되지 않았는지 — '대기중'은 여전히 1건만.
    await page.goto("/s");
    await expect(page.getByText("대기중")).toHaveCount(1);
  } finally {
    await trip.cleanup();
  }
});

test("paid 매칭 학생 → 예약번호·채팅 노출 + 채팅방 입장 가능", async ({ page }) => {
  const scn: StudentPaidScenario = await createStudentPaidScenario();
  try {
    await page.goto("/s");
    await expect(page.getByText("예약 확정")).toBeVisible();
    await expect(page.getByText(scn.code)).toBeVisible();

    // 채팅 입장 — 권한 있음 → 노선 헤더 렌더 + 접근 거부 카피 없음
    await page.goto(`/chat/${scn.tripId}`);
    await expect(page.getByText(scn.destLabel)).toBeVisible();
    await expect(page.getByText("이 채팅방에 접근할 수 없어요.")).toHaveCount(0);
  } finally {
    await scn.cleanup();
  }
});
