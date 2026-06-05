import { test as setup } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

// dev-login(seed 기반 임시 진입점)으로 세션 쿠키를 받아 storageState로 저장한다.
// 각 스펙은 test.use({ storageState })로 재사용 → 매 테스트 로그인 반복 제거.
const authDir = path.join(__dirname, ".auth");
fs.mkdirSync(authDir, { recursive: true });

export const MASTER_STATE = path.join(authDir, "master.json");
export const OPERATOR_GWANGJU_STATE = path.join(authDir, "operator-gwangju.json");

setup("마스터 세션 저장", async ({ page }) => {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: /마스터로 로그인/ }).click();
  await page.waitForURL(/\/admin$/);
  await page.context().storageState({ path: MASTER_STATE });
});

setup("광주(공급) 간사 세션 저장", async ({ page }) => {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: /김광주/ }).click();
  await page.waitForURL(/\/operator/);
  await page.context().storageState({ path: OPERATOR_GWANGJU_STATE });
});
