import { defineConfig, devices } from "@playwright/test";

// E2E는 tests/e2e/**/*.spec.ts. (Vitest 단위는 *.test.ts — 분리됨)
// 실행: npx playwright install (최초 1회) 후 pnpm test:e2e
const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
