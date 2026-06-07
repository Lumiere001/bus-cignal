import { test, expect } from "@playwright/test";
import { OPERATOR_GWANGJU_STATE } from "./support/auth-paths";

// 지도 미동작(로컬엔 카카오 키 없음) 환경에서의 우아한 fallback 회귀 방지.
//   components/kakao/KakaoSearchPicker(방식 B) + 부모 폼의 직접입력/드롭다운 fallback.
//   카카오 SDK/키 없이도 화면이 crash 없이 렌더되고, fallback 입력으로 전환 가능해야 한다.
//
// ⚠️ 순수 fallback 분기(resultToPlace 등)는 export되지 않고 SDK/DOM-bound라 단위 테스트
//    대상이 아니다(load-sdk.test.ts가 server-reject 분기를 이미 커버). 그래서 "키 없는
//    환경에서 fallback UI가 동작"하는 것을 E2E로 검증한다.
//
// 광주(공급) 간사 세션 — 차량 등록·프로필은 간사 영역. seed에 광주 출발/도착지 등록됨.
test.use({ storageState: OPERATOR_GWANGJU_STATE });

test("차량 등록: 키 없이 폼 렌더 + 토글로 드롭다운(목록) fallback 노출", async ({
  page,
}) => {
  await page.goto("/operator/trips/new");

  // 지도 키 없이도 페이지가 crash 없이 렌더(제목·입력 방식 토글 존재).
  await expect(
    page.getByRole("heading", { name: "차량 등록" }),
  ).toBeVisible();
  await expect(page.getByText("출발지 · 도착지")).toBeVisible();

  // 기본은 방식 B(지도) — "목록에서 선택" 토글로 <select> fallback 전환.
  await page.getByRole("button", { name: "목록에서 선택" }).click();

  // fallback 드롭다운(출발지/도착지 <select>)이 보여야 함 — 지도 없이도 입력 가능.
  await expect(page.getByLabel("출발지")).toBeVisible();
  await expect(page.getByLabel("도착지")).toBeVisible();

  // 다시 지도 모드로 돌아가도 crash 없이 토글 동작.
  await expect(
    page.getByRole("button", { name: "지도에서 선택" }),
  ).toBeVisible();
});

test("프로필 장소 등록: 키 없이 '직접 입력' fallback으로 주소 입력 가능", async ({
  page,
}) => {
  await page.goto("/operator/profile");

  await expect(
    page.getByRole("heading", { name: "출발지 · 도착지 관리" }),
  ).toBeVisible();

  // "직접 입력" 토글 → 수동 주소 입력 fallback(지도 미동작 대비).
  await page.getByRole("button", { name: "직접 입력" }).click();

  // 수동 주소 입력란(고유 placeholder) 노출 + 입력 가능(지도 없이도 동작).
  const addressInput = page.getByPlaceholder("예) 강원 평창군 봉평면 무이리");
  await expect(addressInput).toBeVisible();
  await addressInput.fill("강원 평창군 봉평면 무이리 123");
  await expect(addressInput).toHaveValue("강원 평창군 봉평면 무이리 123");

  // 다시 "지도에서 선택"으로 돌아가도 crash 없이 토글 동작.
  await expect(
    page.getByRole("button", { name: "지도에서 선택" }),
  ).toBeVisible();
});
