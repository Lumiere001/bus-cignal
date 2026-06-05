import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Firestore Rules 전용 vitest 설정 — 에뮬레이터 필요.
 * 기본 `pnpm test`(vitest.config.ts)는 `.test.ts`만 잡으므로 `.spec.ts`인 이 테스트는 제외된다.
 * 실행: `pnpm test:rules` (firebase emulators:exec가 에뮬레이터를 띄운 뒤 실행)
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/chat-rules.spec.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
