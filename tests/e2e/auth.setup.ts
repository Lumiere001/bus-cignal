import { test as setup } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  MASTER_STATE,
  OPERATOR_GWANGJU_STATE,
  OPERATOR_BUSAN_STATE,
  OPERATOR_DAEJEON_STATE,
  STUDENT_STATE,
} from "./support/auth-paths";

// dev-login(seed 기반 임시 진입점)으로 세션 쿠키를 받아 storageState로 저장한다.
// 각 스펙은 test.use({ storageState })로 재사용 → 매 테스트 로그인 반복 제거.
fs.mkdirSync(path.dirname(MASTER_STATE), { recursive: true });

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

// 부산(수요) 간사 — seed:dev의 박부산(dev-op-busan, 지구 2801). createApproveScenario가
// 만드는 신청의 소유 지구라, 신청 취소·수정(신청 간사) 흐름을 이 세션으로 검증한다.
setup("부산(수요) 간사 세션 저장", async ({ page }) => {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: /박부산/ }).click();
  await page.waitForURL(/\/operator/);
  await page.context().storageState({ path: OPERATOR_BUSAN_STATE });
});

// 대전(공급) 간사 — seed:dev의 김대전(dev-op-daejeon, 지구 2401). 버스를 아직 안 올린 지구라
// 버스 미배정 대기큐(/operator/wait-queue) 표시·배정 흐름을 이 세션으로 검증한다.
setup("대전(공급·대기큐) 간사 세션 저장", async ({ page }) => {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: /김대전/ }).click();
  await page.waitForURL(/\/operator/);
  await page.context().storageState({ path: OPERATOR_DAEJEON_STATE });
});

// CCC 학생 — seed:dev의 최학생(dev-student-busan, 지구 2801). 학생 직접신청·예약·채팅 흐름 검증.
setup("학생(CCC) 세션 저장", async ({ page }) => {
  await page.goto("/dev/login");
  await page.getByRole("button", { name: /최학생/ }).click();
  await page.waitForURL(/\/s$/);
  await page.context().storageState({ path: STUDENT_STATE });
});
