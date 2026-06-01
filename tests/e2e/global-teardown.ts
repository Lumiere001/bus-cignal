import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env.development.local");

/** globalSetup이 만든 .env.development.local만 제거 (마커 확인). */
export default function globalTeardown() {
  if (
    fs.existsSync(ENV_FILE) &&
    fs.readFileSync(ENV_FILE, "utf8").startsWith("# E2E_AUTOGEN")
  ) {
    fs.rmSync(ENV_FILE);
  }
}
