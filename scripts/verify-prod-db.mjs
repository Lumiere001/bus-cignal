import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// prod DB 마이그·시드 적용 상태 점검 (읽기 전용) — Cowork 2026-06-07 대시보드 시각 점검의 CC 재현용.
//   node scripts/verify-prod-db.mjs              # .env.local 기준
//   node scripts/verify-prod-db.mjs --env .env.prod.local   # prod 키 파일 지정 (1Password에서 받아 생성, gitignored)
//   pnpm verify:prod
// ※ 로컬 dev 머신의 .env.local은 보통 로컬 supabase를 가리킴 → prod 점검 시 --env 또는 env 변수로 prod 키 주입.
// 기대값:
//   - regions = 53행 (시드 적용)
//   - chat_mutes 테이블 존재 (#104 마이그). 초기 0행, 운영 중 증가는 정상.
// ⚠️ 쓰기 절대 없음. service_role 우선(RLS 영향 없는 정확한 카운트), 없으면 anon 폴백.

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

const envFileIdx = process.argv.indexOf("--env");
const envFile = envFileIdx !== -1 ? process.argv[envFileIdx + 1] : ".env.local";
const env = { ...parse(path.join(process.cwd(), envFile)), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL / 키 없음 — .env.local 확인");
  process.exit(1);
}
if (/127\.0\.0\.1|localhost/.test(url)) {
  console.warn(`WARN: 로컬 URL입니다 (${url}) — prod 점검이 목적이면 .env.local 확인`);
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("WARN: anon 키 폴백 — RLS로 카운트가 실제보다 적게 보일 수 있음");
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let fail = false;

async function count(table) {
  const { count: n, error } = await db.from(table).select("*", { count: "exact", head: true });
  return { n, error };
}

// 1) regions = 53
{
  const { n, error } = await count("regions");
  if (error) {
    console.error(`FAIL regions: ${error.message}`);
    fail = true;
  } else if (n === 53) {
    console.log(`PASS regions: ${n}행 (기대 53)`);
  } else {
    console.error(`FAIL regions: ${n}행 (기대 53)`);
    fail = true;
  }
}

// 2) chat_mutes 존재 (행 수는 정보성)
{
  const { n, error } = await count("chat_mutes");
  if (error) {
    console.error(`FAIL chat_mutes: 테이블 조회 실패 — ${error.message} (마이그 미적용?)`);
    fail = true;
  } else {
    console.log(`PASS chat_mutes: 테이블 존재, ${n}행 (초기 0 정상)`);
  }
}

console.log(fail ? "\n결과: FAIL" : "\n결과: 전체 PASS");
process.exit(fail ? 1 : 0);
