import { test, expect } from "@playwright/test";
import { MASTER_STATE } from "./support/auth-paths";

// 마스터 전국 매칭 화면(app/admin/matches/{page,MatchesView,MatchesGraph}.tsx) 회귀 방지.
//   목록/그래프 토글이 동작하고, 그래프 뷰는 svg(노드 있음) 또는 빈 상태 안내를 렌더.
//   PII 비노출 화면이라 데이터 생성 없이 구조만 검증(단언은 seed 볼륨 비의존).
test.use({ storageState: MASTER_STATE });

test("매칭 화면: 제목 + 목록/그래프 토글, 그래프 뷰는 svg 또는 빈 상태", async ({
  page,
}) => {
  await page.goto("/admin/matches");

  // 데이터 유무와 무관하게 항상 렌더되는 헤더.
  await expect(
    page.getByRole("heading", { name: "전체 매칭" }),
  ).toBeVisible();

  // 보기 방식 세그먼트(목록/그래프) 존재.
  const viewGroup = page.getByRole("group", { name: "보기 방식" });
  await expect(viewGroup).toBeVisible();
  await expect(viewGroup.getByRole("button", { name: "목록" })).toBeVisible();

  // 그래프 뷰로 전환 → svg 컨테이너(노드 있을 때) 또는 빈 상태 안내(노드 0).
  await viewGroup.getByRole("button", { name: "그래프" }).click();

  const svg = page.locator("svg[role='group']");
  const emptyState = page.getByText("매칭 내역이 없습니다.");
  // 둘 중 하나는 반드시 — 어느 쪽이든 그래프 컨테이너가 정상 렌더된 것.
  await expect(svg.or(emptyState).first()).toBeVisible();
});
