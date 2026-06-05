import fs from "node:fs";
import path from "node:path";
import { E2E_BLOCK_START, E2E_BLOCK_END } from "./global-setup";

/**
 * globalSetup이 .env.development.local에 추가한 E2E 블록만 제거(나머지 보존).
 * (로컬 supabase 오버라이드 등 사용자 내용은 그대로 둔다.)
 */
const ENV_FILE = path.join(process.cwd(), ".env.development.local");

export default function globalTeardown() {
  if (!fs.existsSync(ENV_FILE)) return;
  const content = fs.readFileSync(ENV_FILE, "utf8");
  const start = content.indexOf(E2E_BLOCK_START);
  if (start === -1) return;
  const endMarker = content.indexOf(E2E_BLOCK_END, start);
  if (endMarker === -1) return;
  const end = endMarker + E2E_BLOCK_END.length;
  // 블록 앞 개행 1개까지 함께 제거.
  const before = content.slice(0, start).replace(/\n$/, "");
  const after = content.slice(end).replace(/^\n/, "");
  fs.writeFileSync(ENV_FILE, `${before}\n${after}`.replace(/\n{3,}/g, "\n\n"), "utf8");
}
