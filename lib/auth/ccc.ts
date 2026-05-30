import "server-only";

/**
 * CCC 로그인 신원 — ccc-summer 진입점에서 CCC가 전달하는 사용자 정보.
 *
 * 받는 필드 (확정):
 *   - cccId · name · phone   (필수)
 *   - regionCode · campus    (받음 — 지구가 오면 자동배정)
 *   - cccRole                (간사/순장/순원 — CCC IT 확인 예정)
 * 미수집: 이메일 · 성별 (용도 없음, PIPA 최소수집).
 */
export type CccIdentity = {
  cccId: string;
  name: string;
  phone: string;
  regionCode?: string | null; // CCC 소속 지구 코드 (있으면 자동배정)
  campus?: string | null;
  cccRole?: string | null; // 간사 / 순장 / 순원 (확인 예정)
};

/**
 * TODO(CCC IT 확정 후 구현): CCC가 전달한 신원 토큰을 검증해 CccIdentity 반환.
 *
 * 신원 전달 방식 후보 (CCC IT 확인 대기):
 *   A. 서명된 토큰(JWT)        — 공유 비밀키/공개키로 서명·만료 검증
 *   B. 일회용 코드 + 검증 API  — code를 CCC 서버에 교환해 신원 수신
 *   C. OIDC                    — 표준 IdP
 *
 * ⚠️ 서명·검증 없는 평문(URL 파라미터) 신뢰 금지 — 간사 위장(다른 지구 명단
 *    열람) 차단을 위해 위·변조 불가능한 방식만 허용.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 스텁: 방식 확정 후 사용
export async function verifyCccToken(token: string): Promise<CccIdentity> {
  throw new Error(
    "verifyCccToken 미구현 — CCC IT의 신원 전달 방식(A 서명토큰 / B 일회용코드 / C OIDC) 확정 후 구현 예정",
  );
}
