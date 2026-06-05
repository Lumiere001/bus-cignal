# 간사 매직링크 로그인 (CCC 본구현 전 임시) (결정)

- **일자**: 2026-06-05
- **결정자**: 팀장(East_Star) — "확인용으로 가장 단순한 방향" 선택
- **요약**: 간사 인증 본구현(CCC)이 외부 대기인 동안, prod에서 간사가 로그인할 경로가 0이라 앱 실사용이 불가했다. 임시로 **마스터가 발급하는 매직링크**(`/login/o/<token>`)로 간사가 입장하게 한다. CCC 신원전달 방식 확정 시 이 경로를 CCC 로그인으로 교체한다.

---

## 배경 (블로커)

- v1.1에서 간사 인증 = CCC 로그인(`lib/auth/ccc.ts:verifyCccToken`). 그런데 CCC IT의 신원 전달 방식(서명토큰/일회용코드/OIDC)이 미확정 → `verifyCccToken`은 스텁(throw).
- prod에서 간사 진입 경로 = CCC(미구현) 뿐이고, `dev-login`은 prod 차단(`ENABLE_DEV_LOGIN` + `NODE_ENV!==production`) → **간사가 로그인할 문이 0** = 앱 핵심(차량 등록·매칭·정산)이 작동 불가.
- 또한 간사가 'pending'으로 생성되는 경로도 없었음(self-signup `/signup`도 placeholder).

## 고려한 옵션

1. **CCC 답 대기** — 외부 확정까지 출시 보류. 일정 통제 불가.
2. **임시 비밀번호 로그인** — operators에 password_hash + 로그인 폼. 마스터 패턴 재사용이나 폼·검증·잠금 등 구현량 ↑.
3. **매직링크 (선택)** — 마스터 승인/생성 시 무작위 토큰 발급 → 마스터가 링크를 카톡으로 전달 → 간사가 링크로 입장. 가장 단순(폼·비번 관리 없음), 마스터 통제(누가 간사인지 마스터가 결정), CCC 무관하게 즉시 사용 가능.

## 결정

**옵션 3(매직링크)** 채택. "일단 확인해야 하니 가장 단순하게."

## 구현

- **마이그** `20260605000003_operator_login_token.sql`: `operators.login_token text` + 부분 unique 인덱스(`where login_token is not null`).
- **토큰** `lib/auth/operator-magic.ts`: 256비트 무작위(base64url). `generateLoginToken()`.
- **입장 라우트** `app/login/o/[token]/route.ts`(GET): 토큰 → `approval_status='approved'`인 operator 조회 → `signOperatorToken` → `bc_operator_session` 쿠키(12h, HttpOnly·SameSite=lax·prod secure) → `/operator` redirect. 미존재/미승인/해제는 `/login?error=invalid`. **토큰 재사용 가능**(방문마다 새 12h 세션 = 만료 후 재입장).
- **온보딩** `app/admin/operators` (마스터): **간사 추가 폼**(이름·전화·지구 → `createOperator` = 즉시 approved + 토큰) + **입장 링크 표시·복사** + **재발급**. 승인(`approveOperator`) 시에도 토큰 발급, 해제(`revokeOperator`) 시 `login_token=null`로 무효화.
- **`/login`** 페이지: "마스터가 보낸 입장 링크로 접속" 안내 + `error=invalid` 표시.

## 검증 (로컬, Docker)

- 마이그 `db reset` 적용 + 타입 재생성(`login_token` 반영). 4 게이트 PASS(typecheck·lint·test 165·build).
- 라이브 curl: 유효 토큰 → `307 /operator` + `bc_operator_session` 쿠키 발급 → 그 쿠키로 `/operator` **200**. 무효 토큰 → `/login?error=invalid` (쿠키 없음).

## 보안·한계

- `login_token` = bearer 자격증명. 마스터만 보유·배포, revoke 시 무효화, 누출 시 재발급. 단일 수련회 내부 도구 + 마스터 배포 모델에서 수용 가능.
- 토큰은 평문 저장(마스터가 링크를 봐야 전달 가능). DB 접근은 service_role 전용 + RLS deny-default라 외부 노출 경로 없음.
- 학생 rate-limit과 별개. 토큰 추측은 256비트라 비현실적.

## 후속 / 재검토

- **CCC 신원전달 방식 확정 시**: `verifyCccToken` 구현 → `/login`을 CCC 로그인으로 교체. 매직링크는 보조(백업) 수단으로 유지하거나 제거 결정.
- self-signup(`/signup`) 경로는 CCC 연동 시 함께 정리.

## Confidence

high (로컬 end-to-end 검증, 기존 세션·승인 패턴 재사용, 앱 무영향 가산)
