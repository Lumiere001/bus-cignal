# Bus Cignal — AI 컨텍스트 (Claude Code 우선)

> **이 저장소에서 작동하는 모든 AI 에이전트는 작업 시작 전 이 문서를 반드시 읽어야 합니다.**
> Claude Code(CC), Codex, Cursor, Cowork 등 모든 AI에 공통 적용.
> 같은 내용이 `AGENTS.md`에 미러링되어 있습니다 (Codex·기타 도구용).

---

## 1. 프로젝트 정체성

**Bus Cignal** = CCC 전국 여름 수련회 **타지구 차량 매칭·정산·소통 통합 시스템**.

- **운영 주체**: CCC IT 사역부
- **운영 목표**: 2026 여름 수련회 (07~08월)
- **현재 단계**: 기획 v1.0 확정, 개발 진입
- **상세 기획**: `docs/SPEC.md` (1100줄 정본)
- **외부 공유용**: `docs/OVERVIEW.md`

타지구 차량 = 본인 소속 지구가 아닌 다른 지구의 차량을 학생이 이용하는 케이스. 이 매칭·정산·운행 당일 소통을 시스템화합니다.

---

## 2. 절대 규칙 (Don't Break)

### 2.1 도메인 코어 (팀장 사전 승인 없이 수정 금지)
- **매칭 엔진** (`lib/matching/*`) — FIFO 큐 + 부분 매칭 + Phase 1/2 데드라인
- **RLS 정책** (Supabase 마이그레이션) — master/operator/passenger 권한
- **정산 로직** (`lib/settlement/*`) — 지구별 ledger·매트릭스
- **Firebase Security Rules** — 채팅 권한 검증

이 영역 PR은 반드시 `core` 라벨 + 팀장 명시 승인.

### 2.2 보안
- 시크릿은 **`.env.local`** (gitignored). 코드·문서에 평문 절대 X
- 만약 시크릿이 commit에 포함되었다면 **즉시 작업 멈추고** 팀장에 알림 + 해당 시크릿 즉시 재발급
- `service_role` key, master 비밀번호, OAuth client secret 등은 **1Password 공유 vault** 보관

### 2.3 Git
- **`main` 직접 push 금지** — PR만 머지 (브랜치 보호 활성)
- **팀장 승인 1명 필수**
- **CI 통과 필수**: typecheck + lint + test
- 시크릿·DB 마이그·매칭 엔진·RLS 변경 PR은 추가 검토
- **`git push --force`** 절대 X (사용자 명시 승인 시만)
- Hook 우회 (`--no-verify`) 금지

### 2.4 개인정보
- 학생 정보 (이름·전화·소속) = 최소 수집·90일 후 자동 익명화
- 외부 API에 개인정보 전송 시 팀장 사전 승인
- 로그·콘솔에 개인정보 평문 출력 X

---

## 3. 기술 스택

| 영역 | 도구 |
|---|---|
| Frontend | Next.js 15 App Router + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| DB·Auth | Supabase PostgreSQL + Auth (Google OAuth) + RLS — Seoul 리전 |
| Chat | Firebase Firestore (asia-northeast3) — 채팅 전용 |
| Maps | 카카오맵 JavaScript SDK |
| Deploy | Vercel (Seoul 우선) |
| Pkg mgr | pnpm |
| Lint·Format | ESLint + Prettier |
| Test | Vitest (단위·통합) + **Playwright E2E (V1 필수, iOS PWA 푸시 포함)** |
| PWA | next-pwa + manifest + service worker + **FCM 푸시 알림** |
| Monitoring | Sentry (무료 plan) |

---

## 4. 폴더 구조 (예정)

```
bus-cignal/
├── app/                        # Next.js App Router
│   ├── (operator)/             # 차량 간사 라우트 그룹
│   ├── (passenger)/            # 학생 (/me, /r/:code 등)
│   ├── (admin)/                # 마스터
│   ├── api/                    # API routes
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn/ui base
│   ├── operator/
│   ├── passenger/
│   └── admin/
├── lib/
│   ├── supabase/               # client/server/types
│   ├── firebase/               # 채팅 SDK
│   ├── kakao/                  # 지도·지오코딩
│   ├── matching/               # ★ 매칭 엔진 (코어)
│   ├── settlement/             # ★ 정산 로직 (코어)
│   ├── validators/             # Zod 스키마
│   └── notifications/
├── supabase/
│   ├── migrations/             # 순차 SQL 마이그레이션
│   └── seed.sql                # 지구 데이터 등
├── docs/
│   ├── SPEC.md                 # v1.0 정본 기획안
│   ├── OVERVIEW.md             # 외부 공유용
│   ├── REGIONS.md              # 지구 마스터
│   └── decisions/              # 결정 로그
├── data/
│   └── regions.csv             # 지구 seed
└── tests/
```

(예정 구조 — base 코드 셋업 후 일부 조정 가능)

---

## 5. 코딩 컨벤션

### TypeScript
- `strict: true` 가정
- `any` 사용 금지 (불가피하면 PR description에 사유)
- 함수 시그니처에 명시적 타입 (return 타입 포함)
- DB 타입은 Supabase 자동 생성 (`pnpm gen:types`)

### 네이밍
- 변수·함수: `camelCase`
- 컴포넌트·타입: `PascalCase`
- 상수: `UPPER_SNAKE_CASE`
- 파일: `kebab-case.ts` (컴포넌트는 `PascalCase.tsx`)
- DB 컬럼: `snake_case`

### 코드 스타일
- Prettier 기본 (저장 시 자동 포맷)
- import 순서: 외부 → 내부 alias → 상대 → CSS
- 한 파일 = 한 export default (최대한)
- 주석: 한국어 OK. 단 "왜"를 설명 (무엇은 코드가 말함)

### 컴포넌트
- shadcn/ui 컴포넌트 우선
- 직접 스타일링 시 Tailwind utility class
- 클라이언트 컴포넌트는 `'use client'` 명시
- 서버 컴포넌트가 기본

### 폼·검증
- Zod 스키마 (`lib/validators/`)
- React Hook Form + zodResolver
- 서버에서 다시 검증 (RLS·서버 액션)

---

## 6. DB 모델 핵심 (v1.0 Confirmed SPEC §6)

### 주요 테이블
- `regions` — 지구 (CCC 지구번호, 권역, 분류, 계좌)
- `operators` — 간사 (Google OAuth + approval_status: pending→approved→rejected)
- `trips` — 운행 (방향·출발지·시간·요금·정원·메모, origin_* nullable)
- `seat_offers` — 공급 슬라이스
- `seat_requests` — 신청 슬라이스 (FIFO 큐, parent_request_id로 분할)
- `request_passengers` — 신청에 묶인 학생 + **priority (1~N, unique per request)** ★
- `matches` — 매칭 (학생 1명당 1개, status: awaiting_payment → payment_reported → paid / expired / cancelled, cancellation_source: operator | passenger | system)
- `match_passengers` — 예약번호 검증용 (access_token_hash)
- `notifications` — 인앱·푸시 (channel)
- `rejection_log` — 거절 단순 로그 (V1, 임계값 X)
- `system_config` — 신청 마감일·점검 모드

**※ v1.0 변경**: `partial_offers` 제거 (우선순위 기반 자동 처리). `request_passengers.priority` 추가.

### RLS 핵심
- master: 전체 R/W + 간사 가입 승인
- operator: 본인 지구 W, 전체 R · 매칭은 양쪽 지구
- passenger: 본인 매칭 R + **자의적 취소 W** + 본인 Trip 채팅

---

## 7. 매칭 알고리즘 핵심 (v1.0 SPEC §7)

**FIFO + 우선순위 기반 자동 부분 매칭** (2h 데드라인·partial_offers 모두 제거):

```
fn approve(request):
  -- 큐 1번째인지 서버 검증 (UI 우회 방지)
  assert request == queue(request.trip)[0]
  avail = available(request.trip)
  passengers = request.passengers ORDER BY priority ASC

  if avail >= request.seat_count:
    -- 전체 매칭 (학생 1명당 Match 1개)
    for p in passengers: Match.create(trip, request, p, payment_due_at=NOW+24h)
    request.status = 'matched'
  elif avail > 0:
    -- 우선순위 N명만 매칭 + 잔여 큐 잔류
    for p in passengers[:avail]: Match.create(trip, request, p, ...)
    new_request = SeatRequest.create(parent_request_id=request.id,
                                     requested_at=request.requested_at,  -- 원본 유지
                                     ...)
    move unmatched passengers to new_request
    request.status = 'matched'  -- 원본은 부분 매칭 완료 처리
  else:
    -- 잔여 0: 자동 거절 + 마스터 알림
    request.status = 'rejected'
    notify_master(request, 'risk_event')

fn on_available_seat_increase(trip, delta):
  -- 다른 매칭 만료·취소·학생 자의 취소 시
  for request in queue(trip):
    passengers = request.unmatched_passengers ORDER BY priority ASC
    matched = min(len(passengers), available(trip))
    for p in passengers[:matched]: Match.create(...)
```

**Phase 1 만료**: matched_at + 24h → 자동 expire, 자리 풀림, 큐 다음 자동 부분 매칭 trigger
**Phase 2 취소**: 송금완료 클릭 후 미입금 시 공급 지구 [매칭 취소] 가능 (status='payment_reported'에서만)
**★ paid 후 공급 측 자의 취소 = 불가능** (학생 자의 취소만 가능)
**학생 자의적 취소**: 양쪽 지구 간사에게 자동 알림 + 자리 풀림

---

## 8. 작업 시 주의사항

### AI 협업 원칙
- 작업 시작 전 이 파일 + `docs/SPEC.md` 관련 섹션 읽기
- 큰 변경 = 작은 PR로 쪼개기
- 매칭 엔진·RLS·정산 = 핸들링 신중. 테스트 케이스 추가 필수
- 시크릿 의심되면 즉시 멈춤
- 대화 길어지면 새 세션 시작 (컨텍스트 품질)
- 자연어 지시만으로 코드 작성·수정·디버깅 가능 (Claude Code 컨벤션)
- 에러 메시지는 그대로 복사해서 AI에게

### ★ AI 작업 시작 강제 절차 (N9 — 사람 부담 0)

사용자가 "오늘 작업 시작" 같은 의도를 표하면 **AI가 사용자 별도 지시 없이 다음 자동 수행**:

1. `git fetch origin main` — 원격 상태 확인
2. `git log HEAD..origin/main --oneline` — 마지막 작업 이후 변경 commit 추출
3. `cat CHANGELOG.md | head -50` — Unreleased 섹션 확인
4. SPEC.md / CLAUDE.md / AGENTS.md diff 변경 자동 분석
5. 본인 작업 영역(branch에서 수정 중인 파일들)에 대한 영향 평가
6. 사용자에게 한 줄 요약 보고 ("SPEC §3 부분 매칭 흐름 변경, 영향 없음" or "...영향 있음, rebase 필요")
7. 필요 시 `git rebase main` 실행 (자동, 충돌 시 사용자 호출)

이 절차는 **사용자가 "skip" 명시하지 않는 한 모든 세션 시작 시 자동**.

### Commit 메시지 (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 신규 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링 (기능 변경 X)
- `docs`: 문서만 변경
- `style`: 포맷·세미콜론 등
- `test`: 테스트 추가·수정
- `chore`: 빌드·설정·의존성

**Scope** (예시):
- `matching` · `settlement` · `chat` · `auth` · `db` · `ui` · `operator` · `passenger` · `admin` · `notifications`

**예시**:
```
feat(matching): partial offer 슬라이스별 독립 데드라인 구현

S3b 시나리오 케이스 1 (잔여 증가 시 자동 추가 offer) 처리.
Supabase Realtime trigger로 trip.available_seats 변동 구독.

Closes #12
```

자세한 규칙: `CONTRIBUTING.md`.

### PR 규칙
- 제목: Conventional Commits 형식
- 본문: 변경 요약 + 테스트 결과 + 관련 SPEC 섹션 링크
- 셀프 리뷰 먼저
- 팀장 리뷰 요청 → 머지

자세한 규칙: `CONTRIBUTING.md`.

---

## 9. 외부 의존성

- **Supabase**: project ref `TBD` (출시 직전), Seoul 리전
- **Firebase**: project `TBD` (출시 직전), asia-northeast3
- **카카오맵**: JavaScript SDK, 도메인 등록 필요
- **Vercel**: 자동 배포, env vars 설정

각 도구 셋업 키·계정은 1Password 공유.

---

## 10. 단계별 진행 (v1.0 SPEC 기준)

1. **Foundation (팀장)**: repo·CI·DB 스키마·Auth·디자인 시스템·기본 라우팅
2. **Feature 분담**: Trip CRUD / 매칭 큐 / 부분 매칭 / 송금·만료 / 학생 화면 / 채팅 / 정산 / 마스터
3. **통합 QA**: E2E 시나리오·모바일 실기기·베타 지구
4. **출시 + 운영**

---

## 11. 관련 문서

| 파일 | 용도 |
|---|---|
| `README.md` | 저장소 첫화면 (짧은 소개·셋업) |
| `docs/SPEC.md` | **v1.0 정본 기획안** (1100줄, 최우선 참조) |
| `docs/OVERVIEW.md` | 외부 공유용 친근 톤 |
| `docs/REGIONS.md` | 전국 지구 마스터 (52개) |
| `docs/decisions/` | 결정 로그 (작성 예정) |
| `ONBOARDING.md` | 팀원 시작 가이드 |
| `CONTRIBUTING.md` | commit·PR·branch 규칙 |
| `COWORK.md` | Cowork 활용 가이드 |
| `AGENTS.md` | Codex 등 다른 AI용 (이 파일 미러) |

---

## 12. 이 문서 변경 시
- 팀장 승인 필수
- `AGENTS.md`도 동기화 (같은 내용)
- 변경 사유를 `docs/decisions/`에 기록 권장
