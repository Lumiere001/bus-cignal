import { test, expect } from "@playwright/test";
import { E2E_CRON_SECRET } from "./support/cron-fixture";

// cron 엔드포인트(돈·PII·알림 트리거) 인증 경계 — Bearer CRON_SECRET 없으면 401.
// global-setup이 dev 서버에 결정적 CRON_SECRET을 주입 → 정상 경로(200)도 검증.
const ENDPOINTS = [
  "/api/cron/depart-reminder",
  "/api/cron/anonymize",
  "/api/cron/payment-reminder",
  "/api/cron/push-retry",
];

test.describe("cron 인증 경계", () => {
  for (const ep of ENDPOINTS) {
    test(`${ep} — 무인증·오인증 401 / 정상 Bearer 200`, async ({ request }) => {
      expect((await request.get(ep)).status()).toBe(401);
      expect(
        (await request.get(ep, { headers: { Authorization: "Bearer wrong-secret" } })).status(),
      ).toBe(401);

      const ok = await request.get(ep, {
        headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
      });
      expect(ok.status()).toBe(200);
      expect(await ok.json()).toMatchObject({ ok: true });
    });
  }
});
