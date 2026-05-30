# Changelog

> Bus Cignal의 변경 기록 (사람·AI 둘 다 읽기 쉬운 형식).
> [Keep a Changelog](https://keepachangelog.com/) 컨벤션 따름.
> AI는 작업 시작 시 **[Unreleased]** 섹션 자동 확인하여 본인 작업 영역 영향 평가.

---

## [Unreleased]

### Changed — v1.1 간사 피드백 반영 (2026-05-30)
- 간사 인증: Google OAuth → **CCC 로그인** (`operators.google_uid`→`ccc_id` + `campus`·`ccc_role`, 자체 세션)
- 매칭: FIFO 강제·우선순위 자동 부분매칭·자동 후속매칭·자동 거절 제거 → **간사 수동 선택** (`priority`=힌트)
- 송금: 24h 자동 만료 폐지 → **소프트 리마인더 + 간사 수동 [자리 풀기]**
- 학생·간사 PWA = **옵트인** / 이메일·성별 **미수집** / 지구 내 차량관리 = V1.5 stretch
- 마이그 `20260530000000_ccc_login_operators.sql` · `lib/auth/{operator-session,ccc}.ts` · `docs/TEAM-TASKS.md`
- 문서 v1.1 동기화: SPEC·OVERVIEW·CLAUDE·AGENTS·CONTRIBUTING·SESSION-HANDOFF·ONBOARDING
- 🔒 카카오 REST API Key 평문 제거 (rotation 권장)

### Added
- 로컬 Supabase (Docker) 셋업 가이드 ONBOARDING §2.3
- OVERVIEW 디테일 보강 (팀·간사 스팩 파악용, 18개 섹션)
- WORKLOG·SESSION-HANDOFF 다음 세션 자동 이어가기 인계 정보
- **`ROLES.md`** — 역할별 권한 모델 (팀장 vs 팀원 vs AI 권한 매트릭스)
- 팀장 vault `team-lead-prompts/` (repo 외부) — 팀장 전용 프롬프트 보관
- **`.team-role.example`** + `.gitignore`의 `.team-role` 추가
  - 팀원 셋업 시 본인 역할 작성 (한 줄)
  - AI 작업 시작 시 자동 읽고 본인 담당 영역 인지·라우팅
  - 본인 분담 외 수정 시도 시 안내
- WORKLOG·SESSION-HANDOFF에 **팀원 초대 직전 산출물** 명시:
  - `docs/TEAM-INVITE-MESSAGE.md` (카톡 안내 멘트)
  - `docs/COLLABORATION-GUIDE.md` (협업 세팅 설명)
  - `docs/TEAM-WARNINGS.md` (주의사항)
  - → Foundation Phase 3 완료 후 AI가 자동 작성·사용자에 제공
- **`docs/OPERATIONS.md`** — 수련회 운영 체크리스트:
  - ⚠️ Firestore reads 50K/일 한도 (D-1 폭주 시 30K~80K 추정 → Blaze 전환 절차)
  - Supabase egress·Vercel build·카카오맵 quota 모니터
  - 익명화 cron 동작 확인 (수련회 종료 + 91일)
  - D-7 통합 점검 체크리스트

### Changed
- CLAUDE.md / AGENTS.md에 역할별 권한 자동 판단 절차 추가
- `docs/AI-PROMPTS/README.md` 갱신 — 공통 vs 팀장 전용 명시
- `cc-to-cowork-supabase-migration.md` — 로컬 dev vs 운영 DB 권한 명시

### Fixed

### Removed
- `docs/AI-PROMPTS/setup-1~5-*.md` + setup-README → 팀장 vault로 이동
  (repo에서 git rm, 팀원 노출 차단)
- `docs/AI-PROMPTS/cc-to-cowork-vercel-env.md` → 팀장 vault로 이동
  (Vercel env 변경은 팀장 전용)

---

## [v1.0-spec-final] - 2026-05-27

### 기획 최종 확정 (Confirmed Final)

추가 결정 완료 (위 v1.0-spec 이후):

- **마스터 인증 = 비밀번호 only** (Google OAuth 제거)
  - 영향: `app/admin/login`, RLS 정책, `MASTER_PASSWORD_HASH` env
- **간사 가입 시 출발/도착지 등록** (region_locations 신설)
  - 영향: `region_locations` 테이블, `/signup` 페이지, Trip 생성 폼
  - 결과: 출발지 미지정 패널티 전면 제거 (S8·`/admin/risk-trips`·D-12h 잠금 모달)
- **디자인 = Claude chat에서 mock 선정** 후 코드 반영
- **PWA 학생 진입 = 옵션 C** (바로 웹 + 시점별 권유)
- **티켓 번호 `BUS-XXXX`** (혼동 글자 제외 30자 셋)
- **잔여 row priority 재정렬** (#7)
- **K2 재신청 추천 = 자리 풀릴 때마다** (#8)
- **학생 자의 취소 시 "환불은 각 지구로 문의" 안내문구** (#14)
- **Trip 수정 단계화** (매칭 전 자유 / 매칭 후 알림 / D-1 이후 강한 안내)
- **익명화 = 매일 새벽 3시 KST** (#15)
- **알림 발송 실패 3회 재시도** (#16) + 마스터 알림
- **iOS PWA QA 체크리스트** 필수 (#17)
- **마스터 비번 분실 복구** 절차 명시 (#18)

### Added (도구 분담 + 세션 손실 방지 시스템)
- `WORKLOG.md` — 작업 진행 (AI 자동 갱신)
- `docs/SESSION-HANDOFF.md` — 도구 전환 인계 (AI 자동 작성)
- `docs/AI-PROMPTS/` — 6개 템플릿 (CC↔Cowork↔Chat)
- `CLAUDE.md` / `AGENTS.md` — AI 작업 시작·종료 강제 절차

### Removed
- `partial_offers` 테이블 (우선순위 기반 자동으로 대체)
- `/admin/risk-trips` 페이지 (location 등록으로 해결)
- D-12h 풀스크린 잠금 모달
- 출발지 미지정 단계별 알림

---

## [v1.0-spec] - 2026-05-27

### 기획 확정 (개발 진입 전 마지막 마일스톤)

- **v1.0 Confirmed** 기획안 확정 (`docs/SPEC.md`)
- 팀원 기획안(이유성·김도영) 검토 후 본 안 채택
- 모든 미해결 안건 결정 완료 (17개)

---

## [v1.0-spec] - 2026-05-27

### 기획 확정 (개발 진입 전 마지막 마일스톤)

- **v1.0 Confirmed** 기획안 확정 (`docs/SPEC.md`)
- 팀원 기획안(이유성·김도영) 검토 후 본 안 채택
- 모든 미해결 안건 결정 완료:
  - 우선순위 기반 자동 부분 매칭 (2h 룰·partial_offers 제거)
  - 학생 검증 = 이름 + 전화 끝 4자리
  - 매칭 후 공급 측 취소 불가 + 승인 전 안내문
  - 학생 자의적 취소 + 양쪽 간사 알림
  - 재신청 추천 UI 도입
  - 간사 가입 → 마스터 승인 흐름
  - 사후 정산 = 캠퍼스 자율 (시스템은 ledger 표만)
  - 거절 모니터링 = V1 단순 알림 (V2 임계값)
  - 시스템 알림 = 인앱 + PWA 푸시 (이메일 X)
  - PWA V1 도입 (FCM, iOS QA 강화 필수)
  - E2E 테스트 V1 필수 (iOS PWA 푸시 포함)
  - 백업 무료 plan만
  - Vercel 기본 도메인
  - 베타 없음, 더미 → 실전
  - public 전환 = 완성 후
  - "팀장"·"Lead" 표기 (개인 별명 비공개)
  - carbus-web과 별개

### 팀원 문서 트리오 작성
- `CLAUDE.md` / `AGENTS.md` — AI 컨텍스트 (Codex 미러)
- `ONBOARDING.md` — 팀원 시작 가이드 (에이전틱 코딩 초보 OK)
- `CONTRIBUTING.md` — commit·PR·branch 규칙
- `COWORK.md` — Cowork 활용
- `CHANGELOG.md` — 본 파일

### 지구 마스터 데이터
- 전국 52개 지구 등록 (`data/regions.csv`, `docs/REGIONS.md`)

---

## 작성 규칙

### Unreleased 섹션
- PR 머지될 때마다 팀장이 한 줄 추가
- AI가 작업 시작 시 자동 확인 (사람 부담 0)

### 카테고리
- **Added**: 신규 기능
- **Changed**: 기존 기능 변경
- **Deprecated**: 곧 제거될 기능
- **Removed**: 제거된 기능
- **Fixed**: 버그 수정
- **Security**: 보안 패치

### 항목 형식
```
- 한 줄 요약 (#PR번호)
  - 영향: 변경된 파일·영역
  - 마이그: 필요 시 마이그레이션 안내
```

### 예시
```
### Changed
- 부분 매칭 데드라인 2h → 우선순위 기반 자동 (#42)
  - 영향: `lib/matching/approve.ts`, B 응답 화면 제거
  - 마이그: `20260601000000_remove_partial_offers.sql` 실행 필요
```

### Release
- `[Unreleased]` → `[vX.Y] - 날짜`로 잠금
- 새 `[Unreleased]` 빈 섹션 신설
