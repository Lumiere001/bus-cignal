# Bus Cignal — AI 컨텍스트 (Codex·기타 도구용)

> **이 파일은 `CLAUDE.md`의 미러입니다.**
> Codex·Cursor·기타 AI 도구가 자기 컨벤션 파일을 읽도록 동일 내용을 제공.
> `CLAUDE.md` 변경 시 이 파일도 동기화 필요.

---

> **TL;DR**: 작업 시작 전 이 문서 + `docs/SPEC.md` 읽기. 매칭 엔진·RLS·정산·시크릿은 East_Star 승인 없이 수정 금지. PR만 머지, main 직접 push X.

---

## 1. 프로젝트 정체성

**Bus Cignal** = CCC 전국 여름 수련회 **타지구 차량 매칭·정산·소통 통합 시스템**.

- **운영 주체**: CCC IT 사역부
- **운영 목표**: 2026 여름 수련회 (07~08월)
- **현재 단계**: 기획 v1.0 확정, 개발 진입
- **상세 기획**: `docs/SPEC.md`

---

## 2. 절대 규칙

### 2.1 도메인 코어 (East_Star 사전 승인 없이 수정 금지)
- 매칭 엔진 (`lib/matching/*`)
- RLS 정책 (Supabase 마이그레이션)
- 정산 로직 (`lib/settlement/*`)
- Firebase Security Rules

### 2.2 보안
- 시크릿은 `.env.local` (gitignored). 코드·문서에 평문 절대 X
- service_role, master 비번 등은 1Password 보관
- 시크릿 의심 시 즉시 멈추고 East_Star 알림

### 2.3 Git
- `main` 직접 push 금지 — PR만
- East_Star 승인 + CI 통과 필수
- `--force` push 절대 X, hook 우회 금지

### 2.4 개인정보
- 학생 정보 최소 수집 + 90일 후 자동 익명화
- 외부 API에 개인정보 전송 시 East_Star 사전 승인

---

## 3. 기술 스택

- Next.js 15 App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL + Auth + RLS) — Seoul
- Firebase Firestore — asia-northeast3 (채팅 전용)
- 카카오맵 JavaScript SDK
- Vercel 배포
- pnpm + ESLint + Prettier + Vitest

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

## 6. DB 모델 핵심

테이블 12개: `regions`, `operators`, `trips`, `seat_offers`, `seat_requests`, `request_passengers`, `partial_offers`, `matches`, `match_passengers`, `notifications`, `rejection_log`, `system_config`.

자세한 스키마는 `docs/SPEC.md` §6.

### RLS
- master: 전체 R/W
- operator: 본인 지구 W, 전체 R
- passenger: 본인 매칭만 R + 본인 Trip 채팅

---

## 7. 매칭 알고리즘 핵심

```
approve(req): FIFO 큐 1번째만 활성, 잔여 ≥ 신청 = 즉시 매칭, 부족 = 부분 매칭
partial: partial_offers 슬라이스별 독립 2h, 잔여 변동 시 자동 갱신
expire: matched_at + 24h 자동, 자리 풀림 + 큐 다음 (수동 promotion)
cancel: 송금완료 후 미입금 시 공급 지구 권한
```

자세한 흐름은 `docs/SPEC.md` §7.

---

## 8. 작업 시 주의

### AI 협업
- 작업 전 이 파일 + `docs/SPEC.md` 관련 섹션 읽기
- 큰 변경 = 작은 PR로 쪼개기
- 매칭·RLS·정산 = 테스트 케이스 필수
- 대화 길어지면 새 세션 (컨텍스트 품질)
- 에러 메시지 그대로 복사해서 AI에게

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
- 셀프 리뷰 후 East_Star 리뷰 요청

---

## 9. 관련 문서

- `README.md` — 저장소 첫화면
- `docs/SPEC.md` — **v1.0 정본 (최우선)**
- `docs/OVERVIEW.md` — 외부 공유 친근 톤
- `docs/REGIONS.md` — 지구 마스터 52개
- `ONBOARDING.md` — 팀원 시작 가이드
- `CONTRIBUTING.md` — commit·PR 규칙
- `COWORK.md` — Cowork 활용
- `CLAUDE.md` — 이 파일의 원본

---

> 이 파일 변경 시 `CLAUDE.md`도 동기화. 변경 사유는 `docs/decisions/`에 기록.
