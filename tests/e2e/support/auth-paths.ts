import path from "node:path";

// storageState 파일 경로 (gitignored: tests/e2e/.auth/). auth.setup가 생성, 스펙이 재사용.
const authDir = path.join(__dirname, "..", ".auth");
export const MASTER_STATE = path.join(authDir, "master.json");
export const OPERATOR_GWANGJU_STATE = path.join(authDir, "operator-gwangju.json");
