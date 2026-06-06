import { defineConfig, devices } from "@playwright/test";

// E2E는 tests/e2e/**/*.{spec,setup}.ts. (Vitest 단위는 *.test.ts — 분리됨)
// 실행: npx playwright install (최초 1회) + supabase start && supabase db reset → pnpm test:e2e
//
// 전용 포트(3100)로 E2E dev 서버를 띄운다 → 사용자의 일반 dev 서버(:3000)와 충돌 X.
// 결정적 마스터 해시는 globalSetup이 .env.development.local에 append(최우선 env) →
// teardown이 제거. (기존 로컬 supabase 오버라이드는 보존 — 과거 클로버 throw 버그 제거.)
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.(spec|setup)\.ts$/,
  fullyParallel: false, // seed 공유 자원 보호 — 순차 실행(워커 1)
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "./test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // 로컬 supabase·seed 사전 점검 + 결정적 마스터 해시 주입 → 누락 시 명확한 안내로 빠르게 실패.
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts$/,
    },
    // 아이폰 사용자 커버리지 — Safari 엔진(WebKit) + iPhone 뷰포트/터치.
    // iOS 호환성의 핵심은 OS가 아니라 WebKit 엔진이라 실제 macOS/iOS 없이 ubuntu에서 검증된다.
    // 학생(공개/예약) 흐름만 대상 — 간사·마스터는 데스크톱 영역이라 chromium으로 충분.
    // (storageState 불필요한 스펙뿐이라 setup 의존 없음.)
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
      testMatch: /(smoke|public-pages|passenger-reservation)\.spec\.ts$/,
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      ENABLE_DEV_LOGIN: "true",
    },
  },
});
