import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { E2E_MASTER_PASSWORD } from "./master-auth.fixtures";

const ENV_FILE = path.join(process.cwd(), ".env.development.local");
const MARKER = "# E2E_AUTOGEN — playwright globalTeardown이 삭제함\n";

/**
 * 마스터 인증 E2E 준비 — E2E_MASTER_PASSWORD의 bcrypt 해시를 .env.development.local에 기록.
 * Next는 .env.development.local을 .env.local보다 우선 로드 → dev 서버가 이 해시로만 로그인됨.
 * (운영·실제 .env.local 해시와 무관). teardown에서 제거.
 */
export default function globalSetup() {
  if (fs.existsSync(ENV_FILE)) {
    const existing = fs.readFileSync(ENV_FILE, "utf8");
    if (!existing.startsWith("# E2E_AUTOGEN")) {
      throw new Error(
        ".env.development.local이 이미 존재(사용자 파일). E2E가 덮어쓰지 않음 — 수동 확인 필요.",
      );
    }
  }
  // bcrypt 해시의 '$'(예: $2b$10$)는 dotenv 변수확장에 먹히므로 '\$'로 이스케이프.
  // (@next/env가 .env*를 dotenv-expand로 처리 — 안 그러면 접두사가 잘려 인증 실패)
  const hash = bcrypt.hashSync(E2E_MASTER_PASSWORD, 10).replace(/\$/g, () => "\\$");
  fs.writeFileSync(ENV_FILE, `${MARKER}MASTER_PASSWORD_HASH=${hash}\n`, "utf8");
}
