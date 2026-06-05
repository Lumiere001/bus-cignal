import { test, expect } from "@playwright/test";
import { createPaidMatchScenario, clearVerifyAttempts } from "./support/db";

// 학생 흐름 = 세션 없는 신선 컨텍스트 (storageState 미사용 — /r 본인확인이 세션 발급).
test.describe("학생 예약 흐름", () => {
  test("본인확인 → /me 예약 조회 + 푸시 옵트인 배너 분기", async ({ page }) => {
    const s = await createPaidMatchScenario();
    try {
      await page.goto(`/r/${s.code}`);
      await page.fill("#name", s.name);
      await page.fill("#phoneLast4", s.phoneLast4);
      await page.getByRole("button", { name: "본인 확인" }).click();

      await expect(page).toHaveURL(/\/me$/);
      await expect(page.getByRole("heading", { name: "내 예약" })).toBeVisible();
      await expect(page.getByText(s.code)).toBeVisible();
      await expect(page.getByText("예약 완료")).toBeVisible();

      // paid 매칭 → 푸시 옵트인 배너 노출(데스크톱 크롬 = ready). 분기: 닫기/다시 보지 않기.
      const banner = page.getByRole("region", { name: "알림 설정 안내" });
      await expect(banner).toBeVisible();
      const dontShow = banner.getByRole("button", { name: "다시 보지 않기" });
      const close = banner.getByRole("button", { name: "닫기" });
      if (await dontShow.count()) await dontShow.click();
      else await close.click();
      await expect(banner).toBeHidden();
    } finally {
      await s.cleanup();
    }
  });

  test("예약 취소 → 취소됨 상태로 전환", async ({ page }) => {
    const s = await createPaidMatchScenario();
    try {
      await page.goto(`/r/${s.code}`);
      await page.fill("#name", s.name);
      await page.fill("#phoneLast4", s.phoneLast4);
      await page.getByRole("button", { name: "본인 확인" }).click();
      await expect(page).toHaveURL(/\/me$/);

      // "취소"/"예약 취소" 등 카피 변화에 견고하게 (MatchCard 취소 진입 버튼).
      await page.getByRole("button", { name: /취소/ }).first().click();
      await expect(page).toHaveURL(/\/me\/cancel\//);
      await page.getByLabel(/위 내용을 확인/).check();
      await page.getByRole("button", { name: "취소 확정" }).click();

      await expect(page).toHaveURL(/\/me(\?|$)/); // 취소 성공 시 /me?cancelled=1
      await expect(page.getByText("취소됨")).toBeVisible();
    } finally {
      await s.cleanup();
    }
  });

  test("본인확인 무차별 대입 → rate-limit 잠금", async ({ page }) => {
    const s = await createPaidMatchScenario();
    try {
      // 잘못된 이름으로 반복 시도 → 임계(7) 초과 시 잠금(8번째 차단).
      // 각 제출의 결과(alert)가 렌더될 때까지 기다려야 실패가 서버에 누적됨.
      let locked = false;
      for (let i = 0; i < 10 && !locked; i++) {
        await page.goto(`/r/${s.code}`);
        await page.fill("#name", "틀린이름");
        await page.fill("#phoneLast4", "0000");
        await page.getByRole("button", { name: "본인 확인" }).click();
        // 결과 메시지(불일치/잠금)가 렌더될 때까지 대기 → 각 제출 완료 보장(서버 누적).
        // (role=alert는 Next 데브툴 alert와 충돌 → 메시지 텍스트로 정확히 대기)
        const msg = page.getByText(/일치하지 않습니다|잠겼어요/);
        await expect(msg).toBeVisible();
        locked = /잠겼어요/.test((await msg.textContent()) ?? "");
      }
      expect(locked).toBe(true);
    } finally {
      await clearVerifyAttempts(s.code);
      await s.cleanup();
    }
  });
});
