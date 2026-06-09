import { test, expect } from "@playwright/test";
import { OPERATOR_BUSAN_STATE } from "./support/auth-paths";
import {
  createApproveScenario,
  createPaidMatchScenario,
  type ApproveScenario,
} from "./support/db";

// 신청 간사(부산) 권한의 신청 취소·수정 회귀 방지.
//   app/operator/requests/[id]/{RequestActions, edit/RequestEditForm}
//   + actions.ts(cancelRequest, updateRequest).
//
// createApproveScenario는 trip=광주(공급), 신청=부산(수요, dev-op-busan) 소유.
// 신청 취소·수정은 "신청 간사" 권한이라 부산 세션으로 구동한다(소유 지구 일치 → 404 회피).
//
// 격리: 각 테스트가 독립 시나리오 생성 + finally cleanup. 단언은 UI 상태 존재/전이 위주
// (정확한 카운트·시각 비의존) — 병렬 픽스처와 충돌하지 않도록.
test.use({ storageState: OPERATOR_BUSAN_STATE });

test("취소: 대기(queued) 신청 → 취소 확정 → 상세에서 '취소됨' + 관리 액션 사라짐", async ({
  page,
}) => {
  const scn: ApproveScenario = await createApproveScenario({ passengers: 2 });
  try {
    await page.goto(`/operator/requests/${scn.requestId}`);

    // 대기중 신청이라 "신청 관리" 액션(수정/취소)이 보여야 함.
    await expect(page.getByRole("heading", { name: "신청 관리" })).toBeVisible();

    // 취소 모달 열기 → 사유(선택) 입력 → 확정.
    await page.getByRole("button", { name: "신청 취소", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByPlaceholder("취소 사유 (선택)")
      .fill("E2E 자동화 — 인원 변동");
    await dialog.getByRole("button", { name: "신청 취소 확정" }).click();

    // 성공 시 목록으로 이동 → 다시 상세를 열어 상태 전이 확인(취소됨, 관리 액션 없음).
    await expect(page).toHaveURL(/\/operator\/requests$/);
    await page.goto(`/operator/requests/${scn.requestId}`);
    await expect(page.getByText("취소됨")).toBeVisible();
    await expect(page.getByRole("heading", { name: "신청 관리" })).toHaveCount(0);
  } finally {
    await scn.cleanup();
  }
});

test("수정: 기존 학생 비식별 필드(학교) 편집 → 동의 불필요 → 저장 후 명단 반영", async ({
  page,
}) => {
  const scn: ApproveScenario = await createApproveScenario({ passengers: 2 });
  try {
    await page.goto(`/operator/requests/${scn.requestId}/edit`);
    await expect(
      page.getByRole("heading", { name: "신청 수정" }),
    ).toBeVisible();

    // 이름·전화(식별자=name|phone)는 그대로 두고 학교/역할(비식별)만 변경.
    //   → 서버 updateRequest는 (이름+전화) 조합으로 신규 학생을 판단하므로 새 학생 아님 → 동의 불필요.
    //   (이름 자체를 바꾸면 신원이 바뀐 것으로 보아 동의를 요구한다 — 별도 테스트가 그 경로를 검증.)
    const firstName = page.getByPlaceholder("이름 *").first();
    await expect(firstName).toHaveValue("E2E학생1");
    const firstSchool = page.getByPlaceholder("학교/역할 (선택)").first();
    await firstSchool.fill("E2E수정학교B");

    await page.getByRole("button", { name: "수정 저장" }).click();

    // 상세로 복귀 + 변경 반영 확인.
    await expect(page).toHaveURL(
      new RegExp(`/operator/requests/${scn.requestId}$`),
    );
    await expect(page.getByText("E2E수정학교B")).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});

test("수정: 새 학생 추가 → 동의 미체크면 차단, 체크 후 저장 성공", async ({
  page,
}) => {
  const scn: ApproveScenario = await createApproveScenario({ passengers: 1 });
  try {
    await page.goto(`/operator/requests/${scn.requestId}/edit`);
    await expect(
      page.getByRole("heading", { name: "신청 수정" }),
    ).toBeVisible();

    // 학생 추가 → 새 행 채우기(이름+전화). 새 학생이라 서버가 동의를 강제.
    await page.getByRole("button", { name: "+ 학생 추가" }).click();
    const names = page.getByPlaceholder("이름 *");
    const phones = page.getByPlaceholder("전화번호 *");
    await names.nth(1).fill("E2E신규학생");
    await phones.nth(1).fill("010-7777-8888");

    // 동의 미체크 상태로 저장 → 차단 에러.
    await page.getByRole("button", { name: "수정 저장" }).click();
    await expect(page.getByText(/개인정보 수집·이용 동의가 필요/)).toBeVisible();

    // 동의 체크 후 재저장 → 성공(상세로 복귀, 새 학생 반영).
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "수정 저장" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/operator/requests/${scn.requestId}$`),
    );
    await expect(page.getByText("E2E신규학생")).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});

test("매칭/예약: 입금 확인된 학생 → 수요 간사 화면에 예약번호 + 링크 복사 노출", async ({
  page,
}) => {
  const scn = await createPaidMatchScenario();
  try {
    await page.goto(`/operator/requests/${scn.requestId}`);

    // 입금 확인 배지 + 예약번호 + '링크 복사' 버튼 → 수요 간사가 학생에게 공유 가능.
    await expect(page.getByText("입금 확인")).toBeVisible();
    await expect(page.getByText(scn.code)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /링크 복사/ }),
    ).toBeVisible();
  } finally {
    await scn.cleanup();
  }
});
