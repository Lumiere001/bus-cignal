# Bus Cignal — Session Handoff

> **AI 자동 생성 파일.** 사람이 직접 편집 X.
> 도구 전환·세션 전환 시 AI가 자동 작성.

---

## 🔄 현재 인계 (Active Handoff)

```
From: CC 세션 (2026-05-30, v1.1 기획 개정 + 팀원 온보딩 준비)
To: 다음 CC 세션 / Cowork / 팀원
목적: 팀원 2명 합류 → feature 병렬 개발 시작
```

### 상황 요약 (2026-05-30 기준)

- **Foundation Phase 1 ✅** (main 머지, PR #1)
- **Foundation Phase 2 진행 중** (`feat/foundation-phase-2`):
  - P2-1 로컬 Supabase ✅ / P2-2 DB 12테이블+RLS골격+지구 seed+타입 ✅
  - P2-3 SSR 클라이언트 4종+미들웨어 ✅ / P2-4 마스터 비번 인증 ✅ (`/admin/login`)
- **🆕 v1.1 기획 개정 (간사 피드백)** — `docs/SPEC.md`·`docs/OVERVIEW.md` v1.1:
  - 간사 = **CCC 로그인** (Google OAuth 폐기) / 매칭 = 시각순 정렬 + 간사 **수동 선택** (FIFO 강제·자동 매칭 제거) / 송금 = **자동 만료 폐지** → 소프트 리마인더 + 수동 [자리 풀기] / 학생·간사 PWA = **옵트인** / 이메일·성별 미수집 / 지구 내 차량관리 = V1.5
  - 코드 반영: 마이그(`20260530000000_ccc_login_operators.sql`)·`lib/auth/operator-session.ts`·`lib/auth/ccc.ts`(스텁)·types·`/login` placeholder
  - 게이트: typecheck 0 · lint 0 · test 2 · build OK
- **🆕 Phase 3 인프라 (2026-05-30)** — 테스트 인프라(seed-dev·`/dev/login`·operator 세션) + PWA manifest + 알림 엔진(`lib/notifications`) + cron(리마인더·익명화) + Playwright·Sentry 스캐폴드 + `docs/GIT-WORKFLOW.md`. 로컬 `supabase db reset` 실 검증 통과.

### 다음 (우선순위)

1. **팀원 2명 온보딩** ← 지금 단계
   - 팀장: GitHub collaborator 추가 (Cowork/gh) + 1Password "Team Dev" vault 공유 (dev 키만)
   - 팀원: `ONBOARDING.md` 따라 셋업 → `docs/TEAM-TASKS.md`의 본인 첫 작업
   - 분담: 팀원1 = 운영자·마스터 UI / 팀원2 = 학생·채팅
2. **간사 인증 (CCC 로그인)** — ⛔ **CCC IT 답 대기** (신원 전달 방식 A/B/C). 스키마·세션 골격·스텁까지 완료, 방식 확정 후 `verifyCccToken` 구현 + `/login` 연동 + `/operator` 가드 + RLS(앱레이어)
3. **Firebase 채팅·FCM 클라이언트 통합** (팀원2 영역, 외부 프로젝트는 생성됨)
4. **PWA (manifest·sw·옵트인 흐름)**

### 블로커

- **간사 인증**: CCC IT의 신원 전달 방식 확정 대기 (간사님께 질문 발송 예정)
- **카카오맵 추가 기능**: 비즈 심사 + 교수님 합의 대기 (기본 JS 지도는 사용 가능)

### 자원 상태

- 로컬 Supabase: `supabase start`로 재개 (데이터 유지)
- `feat/foundation-phase-2`: origin push됨 (단, v1.1 변경분은 **로컬 커밋 후 push 필요**)
- 외부 프로젝트(Supabase·Firebase·카카오·Vercel): 생성 완료

### 시크릿 (참고)

> ⚠️ **모든 키 값은 1Password에만.** git·채팅·문서에 평문 금지.
> (과거 커밋에 카카오 REST API Key가 평문 노출 → **rotation 권장**, 아래 자동화 규칙 참조)

- 운영 시크릿(service_role·Firebase Admin·MASTER_PASSWORD): 팀장 1Password
- 팀원 dev 키(dev Firebase 웹 config): 공유. **카카오 JS/REST 키는 팀원2가 본인 앱 등록해 제공** (팀장 비즈 주체 충돌 예외)

---

## 📚 인계 이력 (Recent Handoffs)

(완료된 인계 시간 역순)

- **2026-05-28** — Foundation Phase 2 P2-1~P2-4 (마스터 비번) 완료. 임시 랜딩(카카오 심사용) 완료.
- 2026-05-27 — 첫 도구 전환 인계 (외부 셋업)

---

## 🛠 자동화 규칙

(`CLAUDE.md`·`AGENTS.md`에 강제 절차 명시되어 있음)

### Trigger (이 파일 자동 작성 의도)
- "Cowork으로 넘기자" / "디자인 mock 만들자 (Chat)" / "Supabase 가서 직접 확인"
- "끝내자", "다음에 이어서" / 세션 포화 임박 알림

### 자동 작성 절차
1. 현재 작업 컨텍스트 요약 (시크릿 평문 금지 — 1Password 참조만)
2. `docs/AI-PROMPTS/` 적절한 템플릿 로드
3. 변수 채워서 복사용 코드 블록 제공
4. 이 파일 `🔄 현재 인계` 섹션 갱신

### 시크릿 노출 대응 (rotation)
- 카카오 REST API Key가 과거 커밋에 평문 노출됨 (private repo). 팀원 합류 전 **rotation 권장**:
  1. 카카오 개발자센터 → 앱 → 보안 → REST API Key 재발급 (Cowork/팀장)
  2. 1Password + Vercel env(`KAKAO_REST_API_KEY`) 갱신 → 재배포
  3. (선택) git history 정리는 private+rotation으로 갈음 (filter-repo는 과함)

### 완료 처리
사용자 인계 완료 알림 시: `🔄 현재 인계` → `📚 인계 이력` 이동 + WORKLOG 갱신
