import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE } from "./support/auth-paths";
import { createApproveScenario, type ApproveScenario } from "./support/db";

// 채팅방 접근 제어(서버 렌더) 회귀 방지 — app/chat/[tripId]/page.tsx.
//   권한 있음 → 노선 헤더("출발지 → 도착지 … 버스 채팅") 렌더, 접근 거부 카피 없음.
//   권한 없음(존재하지 않는 trip) → "이 채팅방에 접근할 수 없어요." + "처음으로 돌아가기".
//
// ⚠️ 로컬엔 Firebase Admin/키가 없어 client ChatRoom은 "준비 중"을 표시한다.
//    그래서 실시간 메시지가 아니라 "서버 렌더 헤더/접근 판정"만 검증한다(접근 경계가 핵심).
//
// 광주(공급) 간사 세션 — getOperatorChatAccess의 공급 경로:
//   trips.operator_region_id === 세션 region(광주) → 매칭 없이도 접근 허용.
//   createApproveScenario의 trip은 광주 소유라 이 세션이 곧장 접근 가능.
test.use({ storageState: OPERATOR_GWANGJU_STATE });

let scn: ApproveScenario;
test.beforeAll(async () => {
  scn = await createApproveScenario({ passengers: 1 });
});
test.afterAll(async () => {
  await scn?.cleanup();
});

test("공급 간사: 소유 trip 채팅 → 노선 헤더 렌더 + 접근 거부 카피 없음", async ({
  page,
}) => {
  await page.goto(`/chat/${scn.tripId}`);

  // seed 출발/도착 라벨(평창 대관령 → 광주 충장로, 하행) 기반 헤더 — "버스 채팅"으로 고정 끝맺음.
  await expect(page.getByText(/버스 채팅/)).toBeVisible();
  await expect(page.getByText("평창 대관령")).toBeVisible();
  await expect(page.getByText("광주 충장로")).toBeVisible();

  // 접근 거부 카피는 없어야 함(권한 있음).
  await expect(page.getByText("이 채팅방에 접근할 수 없어요.")).toHaveCount(0);
});

test("권한 없음: 존재하지 않는 trip → 접근 거부 안내 + 처음으로 링크", async ({
  page,
}) => {
  // 무작위 UUID = 어떤 trip에도 매칭 안 됨 → resolveChatAccess null.
  await page.goto("/chat/00000000-0000-4000-8000-0000000000ff");

  await expect(
    page.getByText("이 채팅방에 접근할 수 없어요."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "처음으로 돌아가기" }),
  ).toBeVisible();
});
