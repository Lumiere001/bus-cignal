import fs from "node:fs";
import path from "node:path";

/**
 * E2E 지원 — 로컬 개발 env(.env.development.local)에서 supabase 접속 키를 읽는다.
 * 이 파일은 next dev가 "로컬 supabase"를 보도록 오버라이드하는 gitignored 파일.
 * (E2E는 항상 로컬 supabase 대상 — 운영 DB 보호를 위해 URL을 검사한다.)
 *
 * ⚠️ 마스터 해시는 여기서 다루지 않는다. playwright.config의 webServer.env로 직접
 *    주입하므로 .env.development.local을 건드리지 않는다 (과거 global-setup이 이 파일을
 *    덮어쓰며 throw하던 버그 제거).
 */
function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (/^\s*#/.test(line) || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) out[key] = val;
  }
  return out;
}

const env = parseEnvFile(path.join(process.cwd(), ".env.development.local"));

export const LOCAL_SUPABASE_URL =
  env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const LOCAL_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * 운영 DB 오작동 방지 — E2E 픽스처는 service_role로 데이터를 생성·삭제하므로
 * 로컬(127.0.0.1/localhost)이 아니면 즉시 거부한다.
 */
export function assertLocalSupabase(): void {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(LOCAL_SUPABASE_URL)) {
    throw new Error(
      `E2E는 로컬 supabase에서만 실행해야 합니다 (운영 DB 보호). 현재 URL: ${LOCAL_SUPABASE_URL}`,
    );
  }
  if (!LOCAL_SERVICE_ROLE_KEY) {
    throw new Error(
      ".env.development.local에 SUPABASE_SERVICE_ROLE_KEY가 없습니다 — 로컬 supabase 오버라이드를 먼저 설정하세요.",
    );
  }
}
