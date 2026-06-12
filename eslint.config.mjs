import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code 세션 워크트리(별도 체크아웃) — 그 안의 .next 빌드 산출물이
    // 루트 lint에 끌려 들어와 가짜 에러를 내므로 통째로 제외.
    ".claude/**",
  ]),
]);

export default eslintConfig;
