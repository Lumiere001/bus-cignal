# Bus Cignal — AI 컨텍스트 (Codex·기타 도구용)

> **이 파일은 `CLAUDE.md`의 미러입니다.**
> Codex·Cursor·기타 AI 도구가 자기 컨벤션 파일을 읽도록 동일 내용을 제공.
> `CLAUDE.md` 변경 시 이 파일도 동기화 필요.

---

> **TL;DR**: 작업 시작 전 이 문서 + `docs/SPEC.md` 읽기. 매칭 엔진·RLS·정산·시크릿은 팀장 승인 없이 수정 금지. PR만 머지, main 직접 push X.

---

## 1. 프로젝트 정체성

**Bus Cignal** = CCC 전국 여름 수련회 **타지구 차량 매칭·정산·소통 통합 시스템**.

- **운영 주체**: CCC IT 사역부
- **운영 목표**: 2026 여름 수련회 (07~08월)
- **현재 단계**: 기획 v1.0 확정, 개발 진입
- **상세 기획**: `docs/SPEC.md`

---

## 2. 절대 규칙

### 2.1 도메인 코어 (팀장 사전 승인 없이 수정 금지)
- 매칭 엔진 (`lib/matching/*`)
- RLS 정책 (Supabase 마이그레이션)
- 정산 로직 (`lib/settlement/*`)
- Firebase Security Rules

### 2.2 보안
- 시크릿은 `.env.local` (gitignored). 코드·문서에 평문 절대 X
- service_role, master 비번 등은 1Password 보관
- 시크릿 의심 시 즉시 멈추고 팀장 알림

### 2.3 Git
- `main` 직접 push 금지 — PR만
- 팀장 승인 + CI 통과 필수
- `--force` push 절대 X, hook 우회 금지

### 2.4 개인정보
- 학생 정보 최소 수집 + 90일 후 자동 익명화
- 외부 API에 개인정보 전송 시 팀장 사전 승인

---

## 3. 기술 스택

- Next.js 16 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + RLS) — Seoul. 간사 인증 = CCC 로그인 + 자체 세션 (Supabase Auth 미사용)
- Firebase Firestore — asia-northeast3 (채팅 전용)
- 카카오맵 JavaScript SDK
- Vercel 배포 (기본 도메인)
- pnpm + ESLint + Prettier + Vitest + **Playwright E2E (V1 필수)**
- **PWA: next-pwa + FCM 푸시 알림** (iOS QA 강화)
- Sentry (무료 plan)

---

## 4. 폴더 구조

```
bus-cignal/
├── app/                        # Next.js App Router
├── components/                 # shadcn/ui + 도메인별
├── lib/
│   ├── supabase/
│   ├── firebase/
│   ├── kakao/
│   ├── matching/               # ★ 코어
│   ├── settlement/             # ★ 코어
│   └── validators/
├── supabase/migrations/
├── docs/
└── data/
```

---

## 5. 코딩 컨벤션

- TypeScript strict, `any` 금지
- 네이밍: 변수 camelCase, 컴포넌트 PascalCase, 상수 UPPER_SNAKE
- 파일: kebab-case (컴포넌트 PascalCase.tsx)
- DB: snake_case
- Prettier 기본, ESLint 통과 필수
- 주석은 "왜"를 설명 (한국어 OK)
- Zod 스키마 + 서버에서 재검증

---

## 6. DB 모델 핵심 (v1.1)

테이블 12개: `regions`·`operators`(**ccc_id**·campus·ccc_role·approval_status)·`region_locations`·`trips`·`seat_offers`·`seat_requests`·`request_passengers`(**priority**=힌트)·`matches`(passenger_id·cancellation_source)·`match_passengers`·`notifications`(channel)·`rejection_log`·`system_config`.

자세한 스키마는 `docs/SPEC.md` §6.

### RLS
- master: 전체 R/W + 간사 승인
- operator: 본인 지구 W, 전체 R
- passenger: 본인 매칭 R + **자의 취소 W** + 본인 Trip 채팅

---

## 7. 매칭 방식 핵심 (v1.1)

**시각순 정렬 + 간사 수동 선택** (FIFO 강제·자동 매칭 전부 제거):

```
approve(req, selected_ids):
  큐 = requested_at ASC 정렬 (보여주기용, 강제 잠금 없음)
  공급 간사가 어느 신청이든 + 그 안의 학생을 직접 선택
  selected 학생만 Match 생성 (avail 한도 검사). 나머지는 큐 잔류 (자동 분할 X)
  자동 거절 없음 — 안 태우면 큐에 남음

release_seat(match): 송금 지연 등 간사 수동 [자리 풀기] → status=expired (자동 cron 아님)
on_seat_freed(trip): 자동 재매칭 X — 큐 재노출 + 알림 + 재신청 추천
payment_delay_reminder: 자동 만료 아님 — 리마인더만 (자리 회수 X)
cancel (Phase 2): 송금완료 후 미입금 시 공급 지구 권한 (status='payment_reported'에서만)
★ paid 후 공급 측 자의 취소 = 불가능
passenger_cancel: 학생 자의 취소 → 양쪽 간사 알림 + 자리 풀림
```

자세한 흐름은 `docs/SPEC.md` §7.

**※ v1.1 변경**: FIFO 강제·우선순위 자동 부분매칭·자동 후속매칭·24h 자동만료 모두 제거. priority=힌트.

---

## 8. 작업 시 주의

### AI 협업
- 작업 전 이 파일 + `docs/SPEC.md` 관련 섹션 읽기
- 큰 변경 = 작은 PR로 쪼개기
- 매칭·RLS·정산 = 테스트 케이스 필수
- 대화 길어지면 새 세션 (컨텍스트 품질)
- 에러 메시지 그대로 복사해서 AI에게

### ★ AI 작업 시작 강제 절차 (사람 부담 0)
사용자가 "작업 이어가자" 의도 표하면 별도 지시 없이 자동:
1. `git fetch origin main`
2. `git log HEAD..origin/main --oneline` 변경 commit
3. `cat CHANGELOG.md | head -50` Unreleased
4. `cat WORKLOG.md` 어디서 끊겼는지·다음 단계
5. `cat docs/SESSION-HANDOFF.md` 다른 도구 인계
6. **`cat .team-role 2>/dev/null`** ← 본인 역할 인지
   - team-lead → 팀장. `ls vault/team-lead-prompts/` 추가 확인
   - team-member-1-operator → 팀원 1 (운영자·마스터 UI)
   - team-member-2-passenger → 팀원 2 (학생·채팅)
   - 없음 → 첫 사용자에 역할 묻기 → 답변 자동 저장
7. SPEC.md / CLAUDE.md / AGENTS.md diff 분석
8. 본인 작업 영역 영향 평가
9. 사용자에 한 줄 요약 보고 (본인 역할 포함)
10. 필요 시 rebase 자동

### ★ AI 작업 종료 강제 절차
사용자가 "끝내자", "Cowork으로 넘기자" 같은 의도 표하면 자동:
1. `WORKLOG.md` 자동 갱신 (현재 작업·다음 단계·완료된 것)
2. 도구 전환이면 `docs/SESSION-HANDOFF.md` 작성 + `docs/AI-PROMPTS/` 템플릿으로 사용자에 복사용 프롬프트 제공

### 도구 분담
- **CC**: 코드·터미널·git·DB SQL
- **Cowork**: Supabase·Vercel·Firebase GUI·GitHub UI
- **Claude Chat**: UI 디자인 mock·copy·기획 논의

자동 라우팅: 사용자 요청 분석 후 적절한 도구로 인계 제안.

### ★ 역할별 권한 (ROLES.md 참조)

**작업 시작 시 자동 판단**:
```bash
ls /Users/east_star/LIFE/projects/bus-cignal/team-lead-prompts/ 2>/dev/null
```
- 존재 = 팀장 머신, 모든 작업 가능
- 부재 = 팀원 머신, 본인 분담만 (외부 셋업·운영·시크릿 차단)

**팀장 전용**: 외부 도구 셋업, 운영 DB 마이그, env 변경, 마스터 비번, branch 보호, 간사 승인, main 머지.

**팀원 분담**:
- 팀원 1: 운영자·마스터 UI
- 팀원 2: 학생·채팅

팀원이 팀장 작업 요청 시 → "팀장에게 요청해 주세요" 안내.

**프롬프트 위치**:
- 공통: `docs/AI-PROMPTS/` (repo, 누구나)
- 팀장 전용: vault `team-lead-prompts/` (팀장만)

### Commit (Conventional Commits)
```
<type>(<scope>): <subject>
```

Type: feat / fix / refactor / docs / style / test / chore
Scope: matching · settlement · chat · auth · db · ui · operator · passenger · admin · notifications

자세한 규칙: `CONTRIBUTING.md`.

### PR
- 제목 = Conventional Commits 형식
- 본문 = 변경 요약 + 테스트 결과 + SPEC 섹션 링크
- 셀프 리뷰 후 팀장 리뷰 요청

---

## 9. 관련 문서

- `README.md` — 저장소 첫화면
- `docs/SPEC.md` — **v1.1 정본 (최우선)**
- `docs/OVERVIEW.md` — 외부 공유 친근 톤
- `docs/REGIONS.md` — 지구 마스터 53개
- `ONBOARDING.md` — 팀원 시작 가이드
- `CONTRIBUTING.md` — commit·PR 규칙
- `COWORK.md` — Cowork 활용
- `CLAUDE.md` — 이 파일의 원본

---

> 이 파일 변경 시 `CLAUDE.md`도 동기화. 변경 사유는 `docs/decisions/`에 기록.
