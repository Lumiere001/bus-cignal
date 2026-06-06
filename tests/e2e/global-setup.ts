import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { db } from "./support/db";
import { assertLocalSupabase } from "./support/env";
import { E2E_MASTER_PASSWORD } from "./master-auth.fixtures";
import { E2E_CRON_SECRET } from "./support/secrets";

/**
 * E2E 사전 점검 + 결정적 마스터 해시 주입.
 *
 * ① 로컬 supabase가 떠 있고 seed가 로드됐는지 확인 → 아니면 "무엇을 해야 하는지"를
 *    명확히 알려주며 빠르게 실패 (직접 클릭해 원인 찾는 대신 셋업 단계에서 진단).
 * ② E2E_MASTER_PASSWORD의 bcrypt 해시를 .env.development.local에 "추가"한다.
 *    - .env.development.local은 .env.local보다 우선 → dev 서버가 이 해시로만 로그인됨(운영 무관).
 *    - 기존 내용(로컬 supabase 오버라이드)을 보존하기 위해 덮어쓰지 않고 append.
 *      (과거 global-setup은 이 파일이 존재하면 throw → 본 환경에서 E2E가 깨졌었음. 이를 제거.)
 *    - bcrypt 해시의 '$'(예: $2b$10$)는 @next/env의 dotenv-expand에 먹히므로 '\$'로 이스케이프.
 *    - globalTeardown이 이 블록만 제거(나머지 보존).
 */
const ENV_FILE = path.join(process.cwd(), ".env.development.local");
export const E2E_BLOCK_START = "# >>> E2E_AUTOGEN (playwright globalTeardown이 제거)";
export const E2E_BLOCK_END = "# <<< E2E_AUTOGEN";

export default async function globalSetup() {
  assertLocalSupabase();

  const { count: regions, error: rErr } = await db
    .from("regions")
    .select("id", { count: "exact", head: true });
  if (rErr) {
    throw new Error(
      `로컬 supabase 연결 실패 (${rErr.message}) → 'supabase start' 후 다시 실행하세요.`,
    );
  }
  if (!regions) {
    throw new Error(
      "regions가 비어 있습니다 → 'supabase db reset'으로 마이그+seed를 로드하세요.",
    );
  }

  const { count: operators } = await db
    .from("operators")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "approved");
  if (!operators || operators < 2) {
    throw new Error(
      "승인된 seed 간사(김광주·박부산)가 없습니다 → 'supabase db reset'으로 seed-dev.sql을 로드하세요.",
    );
  }

  const existing = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  if (!existing.includes(E2E_BLOCK_START)) {
    const hash = bcrypt.hashSync(E2E_MASTER_PASSWORD, 10).replace(/\$/g, () => "\\$");
    // CRON_SECRET도 결정적 값으로 주입 → cron 인증(Bearer) 경로 테스트 가능. ('$' 없음 → 이스케이프 불필요)
    const block = `\n${E2E_BLOCK_START}\nMASTER_PASSWORD_HASH=${hash}\nCRON_SECRET=${E2E_CRON_SECRET}\n${E2E_BLOCK_END}\n`;
    fs.writeFileSync(ENV_FILE, existing + block, "utf8");
  }
}
