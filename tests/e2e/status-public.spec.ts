import { test, expect } from "@playwright/test";

// /status 무로그인·무PII 전국 현황(app/status/{page,StatusView}.tsx) 회귀 방지.
//   세션 없이 렌더되어야 하고, 제목 + 전국 합계 롤업 + (지구 행 또는 빈 상태)가 보여야 한다.
//   학생/간사 PII 마커가 한 글자도 노출되지 않아야 한다(공개 페이지 핵심 불변식).
//
// 단언은 seed 볼륨에 비의존(정확한 잔여석 수 등 X) — 구조와 PII-부재만 검증.

test.describe("공개 현황 /status", () => {
  test("무로그인 렌더 + 제목 + 전국 합계 롤업", async ({ page }) => {
    const res = await page.goto("/status");
    expect(res?.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", { name: "전국 지구별 잔여석 현황" }),
    ).toBeVisible();

    // 전국 합계 섹션(숫자 롤업) — aria-label로 안정 식별.
    const totals = page.getByRole("region", { name: "전국 합계" });
    await expect(totals).toBeVisible();
    await expect(totals.getByText("공개 차량", { exact: true })).toBeVisible();
    await expect(totals.getByText("전국 잔여석", { exact: true })).toBeVisible();
    // "대기 인원" 라벨은 같은 영역의 설명 문구("대기 인원 = …")와 부분일치하므로 exact로 한정.
    await expect(totals.getByText("대기 인원", { exact: true })).toBeVisible();

    // 지구 목록(li) 또는 빈 상태 카피 중 하나는 반드시 존재.
    const regionItems = page.getByRole("listitem");
    const emptyState = page.getByText("아직 공개된 차량이나 신청이 없습니다.");
    const hasRegions = (await regionItems.count()) > 0;
    const hasEmpty = (await emptyState.count()) > 0;
    expect(hasRegions || hasEmpty).toBeTruthy();

    // 무PII 푸터 고지 — 공개 페이지 약속.
    await expect(
      page.getByText("본 페이지는 개인정보를 포함하지 않습니다.", {
        exact: false,
      }),
    ).toBeVisible();
  });

  test("PII 마커가 없다(이름·전화 형식·예약번호)", async ({ page }) => {
    await page.goto("/status");
    await expect(
      page.getByRole("heading", { name: "전국 지구별 잔여석 현황" }),
    ).toBeVisible();

    const body = await page.locator("body").innerText();
    // 전화번호 패턴(010-####-#### 등) — 학생/간사 연락처가 새지 않아야 함.
    expect(body).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/);
    // 예약번호 패턴(BUS-XXXX) — 공개 현황엔 노출 금지.
    expect(body).not.toMatch(/BUS-[A-Z0-9]{4}/);
    // seed 학생/간사 이름 노출 금지(대표 샘플).
    for (const piiName of ["김광주", "박부산", "이지은"]) {
      expect(body).not.toContain(piiName);
    }
  });
});
