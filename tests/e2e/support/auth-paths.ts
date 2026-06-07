import path from "node:path";

// storageState 파일 경로 (gitignored: tests/e2e/.auth/). auth.setup가 생성, 스펙이 재사용.
const authDir = path.join(__dirname, "..", ".auth");
export const MASTER_STATE = path.join(authDir, "master.json");
export const OPERATOR_GWANGJU_STATE = path.join(authDir, "operator-gwangju.json");
// 부산(수요) 간사 — createApproveScenario가 만드는 신청의 소유 지구(2801)와 일치.
// 신청 취소·수정(신청 간사 권한) E2E에서 사용.
export const OPERATOR_BUSAN_STATE = path.join(authDir, "operator-busan.json");
