import path from "node:path";

// storageState 파일 경로 (gitignored: tests/e2e/.auth/). auth.setup가 생성, 스펙이 재사용.
const authDir = path.join(__dirname, "..", ".auth");
export const MASTER_STATE = path.join(authDir, "master.json");
export const OPERATOR_GWANGJU_STATE = path.join(authDir, "operator-gwangju.json");
// 부산(수요) 간사 — createApproveScenario가 만드는 신청의 소유 지구(2801)와 일치.
// 신청 취소·수정(신청 간사 권한) E2E에서 사용.
export const OPERATOR_BUSAN_STATE = path.join(authDir, "operator-busan.json");
// CCC 로그인 학생(부산, seed 최학생) — 학생 직접신청·채팅 E2E에서 사용.
export const STUDENT_STATE = path.join(authDir, "student.json");
// 대전(공급) 간사 — seed:dev의 김대전(dev-op-daejeon, 지구 2401). 버스를 아직 안 올린
// 지구라 버스 미배정 대기큐(wait-queue) 표시·배정 E2E에서 공급측 세션으로 사용.
export const OPERATOR_DAEJEON_STATE = path.join(authDir, "operator-daejeon.json");
