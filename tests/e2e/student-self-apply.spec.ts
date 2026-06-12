import { test, expect } from "@playwright/test";
import { STUDENT_STATE } from "./support/auth-paths";
import {
  createStudentTrip,
  createStudentPaidScenario,
  type StudentTripScenario,
  type StudentPaidScenario,
} from "./support/db";

// CCC 학생 직접 신청(Phase 2·3) — 학생 세션(최학생, 부산)으로 검증.
//   허브(/s) → 예약하기(위저드 /s/apply) / 예약 확인(브리지 → /me).
//   ⚠️ 로컬엔 Firebase Admin/키가 없어 채팅 client는 "준비 중"을 표시 → 채팅은
//      "서버 렌더 헤더/접근 판정"만 검증(접근 경계가 핵심).
test.use({ storageState: STUDENT_STATE });

// 위저드: 조회(방향 down 으로 스왑) → 버스 조회 → 격리 차량 선택 → 신청 확인.
async function applyToFixtureTrip(
  page: import("@playwright/test").Page,
  destLabel: string,
) {
  await page.goto("/s/apply");
  // 격리 trip은 down(평창→광주) — 기본 방향(up)에서 스왑.
  await page.getByRole("button", { name: "출발·도착 바꾸기" }).click();
  // 기본 지구 = 본인 출신 지구(부산, #대기큐 위저드 개편) — 격리 trip의 공급 지구(광주)로 변경.
  await page.getByLabel("지구 선택").selectOption("광주지구");
  await page.getByRole("button", { name: "버스 조회" }).click();
  // 차량 선택 → '이 차량 신청'
  await page.getByRole("button", { name: destLabel }).click();
  await page.getByRole("button", { name: "이 차량 신청" }).click();
  // 신청 확인: 본인정보 미리채움 + 동의 → 신청
  await expect(page.getByText("최학생")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "신청하기" }).click();
}

test("학생 직접 신청(위저드) → /s 진행 중 신청에 '대기중' 표시", async ({ page }) => {
  const trip: StudentTripScenario = await createStudentTrip();
  try {
    await applyToFixtureTrip(page, trip.destLabel);
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
    // 1차 신청 → /s
    await applyToFixtureTrip(page, trip.destLabel);
    await page.waitForURL(/\/s$/);
    await expect(page.getByText("대기중")).toBeVisible();

    // 2차 신청 시도(같은 차량) → 서버 중복 가드가 막고 신청 확인 화면에 안내(redirect 안 됨).
    await applyToFixtureTrip(page, trip.destLabel);
    await expect(page.getByText(/이미 신청한 차량/)).toBeVisible();

    // 중복 저장 안 됨 — '대기중' 1건만.
    await page.goto("/s");
    await expect(page.getByText("대기중")).toHaveCount(1);
  } finally {
    await trip.cleanup();
  }
});

test("예약 확인 → /me 진입(브리지) + 예약번호·채팅 노출 + 채팅방 입장", async ({
  page,
}) => {
  const scn: StudentPaidScenario = await createStudentPaidScenario();
  try {
    // 허브에서 '예약 확인' → passenger 세션 브리지 → 기존 /me
    await page.goto("/s");
    await page.getByRole("link", { name: /예약 확인/ }).click();
    await page.waitForURL(/\/me$/);
    await expect(page.getByText(scn.code)).toBeVisible();
    await expect(page.getByText(scn.destLabel)).toBeVisible();

    // 채팅 입장(접근 경계) — 권한 있음 → 노선 헤더 렌더 + 접근 거부 카피 없음
    await page.goto(`/chat/${scn.tripId}`);
    await expect(page.getByText(scn.destLabel)).toBeVisible();
    await expect(page.getByText("이 채팅방에 접근할 수 없어요.")).toHaveCount(0);
  } finally {
    await scn.cleanup();
  }
});
