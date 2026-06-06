import fs from "node:fs";
import path from "node:path";

// 로컬 supabase 접속 키를 .env.development.local에서 읽는다 (E2E와 동일 소스).
// ⚠️ 부하/더미 스크립트는 service_role로 대량 생성·삭제 → 반드시 로컬에서만.
function parse(file) {
  const o = {};
  if (!fs.existsSync(file)) return o;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (/^\s*#/.test(line) || !line.includes("=")) continue;
    const i = line.indexOf("=");
    o[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return o;
}

const env = parse(path.join(process.cwd(), ".env.development.local"));
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function assertLocal() {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL)) {
    throw new Error(`로컬 supabase가 아닙니다 (운영 보호) — URL: ${SUPABASE_URL}`);
  }
  if (!SERVICE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 없음 — .env.development.local 확인");
  }
}

export function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
