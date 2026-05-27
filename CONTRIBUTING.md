# Contributing to Bus Cignal

> Commit·PR·Branch 규칙. 모든 기여자(사람·AI) 공통.

---

## 1. Branch 네이밍

```
<type>/<영역>-<짧은-요약>
```

**Type**:
- `feat/` — 신규 기능
- `fix/` — 버그 수정
- `refactor/` — 리팩토링
- `docs/` — 문서만
- `test/` — 테스트
- `chore/` — 빌드·설정·의존성

**예시**:
- `feat/matching-fifo-queue`
- `fix/auth-google-oauth-redirect`
- `refactor/settlement-matrix-query`
- `docs/spec-v1-clarify-partial-match`

---

## 2. Commit 메시지 (Conventional Commits)

### 형식
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type (Branch와 동일)
- `feat` · `fix` · `refactor` · `docs` · `style` · `test` · `chore`

### Scope (영역)
- `matching` — 매칭 엔진·큐
- `settlement` — 정산·ledger
- `chat` — Firebase 채팅
- `auth` — Google OAuth·세션
- `db` — 마이그레이션·RLS·시드
- `ui` — 디자인 시스템·shadcn 컴포넌트
- `operator` — 차량 간사 화면
- `passenger` — 학생 화면
- `admin` — 마스터 화면
- `notifications` — 인앱·이메일
- `kakao` — 카카오맵·지오코딩
- `infra` — Vercel·CI·deps
- `meta` — 문서·repo 설정

### Subject (제목 첫 줄)
- 한글 OK
- 명령형 ("추가했음" X, "추가" O)
- 마침표 X
- 50자 이내 권장

### Body (본문, 선택)
- "왜" 변경했는지 (무엇은 코드가 말함)
- 한 줄 띄우고 작성
- 줄당 72자 이내 권장

### Footer (선택)
- `Closes #12` — 이슈 닫기
- `Co-Authored-By: ...` — 공동 작업자
- `BREAKING CHANGE: ...` — 호환 깨짐

### 예시

**Good**:
```
feat(matching): partial_offers 슬라이스별 독립 데드라인 구현

S3b 케이스 1 (잔여 자리 증가 시) 처리. Supabase Realtime trigger로
trip.available_seats 변동 구독, 자동으로 partial_offer 추가 생성.

각 offer는 본인 offered_at + 2h 데드라인 (reset 없음).

Closes #12
```

**Good**:
```
fix(auth): Google OAuth redirect 후 세션 누락 수정

Vercel의 cold start에서 cookie가 SetCookie 헤더로 전송되지 않던
이슈. middleware에서 명시적으로 cookie write 추가.

Refs: docs/SPEC.md §8 권한 모델
```

**Bad**:
```
update                                    # 무엇을 변경했는지 모름
fixed bug                                 # 어떤 버그?
WIP                                       # commit 메시지에 WIP X
asdf                                      # 의미 없음
feat: 기능 추가했어요                       # scope 없음, 어떤 기능?
```

### AI 작성 시 주의
AI에게 "commit 메시지 써줘"하지 말고, **본인이 본 변경을 한 줄 요약 후 AI에게 검토 요청** 하는 게 정확함.

### Co-author (AI 사용)

본인이 작성한 코드면 본인 이름. AI가 작성하고 본인이 검토만 했으면 footer에:

```
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

---

## 3. Pull Request 규칙

### 제목
- Commit 메시지 형식과 동일
- `feat(matching): partial_offers 슬라이스별 데드라인`

### 본문 템플릿

```markdown
## 변경 요약
- (3~5줄로 무엇을 했는지)

## 왜 필요한가
- (SPEC 참조 등)

## 관련 SPEC
- docs/SPEC.md §3.S3b
- docs/SPEC.md §6 (partial_offers)
- docs/SPEC.md §7.4

## 테스트
- [ ] pnpm typecheck
- [ ] pnpm lint
- [ ] pnpm test
- [ ] 로컬에서 동작 확인
- [ ] (해당 시) E2E 시나리오 확인

## 스크린샷·기록 (UI 변경 시)
(이미지·gif)

## 체크리스트
- [ ] 시크릿이 커밋에 포함되지 않았는지
- [ ] DB 마이그레이션은 별도 PR (또는 명시)
- [ ] RLS·매칭 엔진·정산 변경 시 East_Star 사전 합의
- [ ] 관련 문서 업데이트 (필요 시)
```

### PR 크기
- **300줄 이하 권장** (코드 only)
- 큰 변경은 sub-PR로 쪼개기
- 마이그레이션·매칭 엔진은 더 작게

### Draft PR
- 초안 상태면 Draft로 생성 (CI 돌고 본인이 self-review 후 Ready)

### 리뷰
- East_Star approve 1명 필수
- 변경 요청 받으면 추가 commit (force push X — squash는 merge 시점에)
- 머지 권한은 East_Star만

### 머지 방식
- 기본: **Squash and merge** (히스토리 깔끔)
- 큰 feature는 **Merge commit** (히스토리 보존 가치 있을 때)
- Rebase는 안 함 (저자 commit 분리 보존 어려움)

---

## 4. 코드 스타일

### 자동화
- 저장 시 Prettier 자동 포맷 (`.vscode/settings.json` 권장)
- 커밋 전 자동 lint (husky pre-commit, 있다면)

### 수동 체크
```bash
pnpm lint
pnpm typecheck
pnpm test
```

### 네이밍
- 변수·함수: `camelCase`
- 컴포넌트·타입: `PascalCase`
- 상수: `UPPER_SNAKE_CASE`
- 파일: `kebab-case.ts`, 컴포넌트는 `PascalCase.tsx`
- DB 컬럼: `snake_case`

### TypeScript
- `strict: true`
- `any` 사용 시 PR 본문에 사유 (불가피한 경우만)
- DB 타입은 자동 생성 (`pnpm gen:types`)

### React·Next.js
- 서버 컴포넌트 기본, 클라이언트는 `'use client'` 명시
- shadcn/ui 우선
- Tailwind utility class (custom CSS는 최소)

### 주석
- "왜"를 설명 (무엇은 코드가 말함)
- 한국어 OK
- TODO·FIXME는 GitHub Issue로 옮기기 권장

---

## 5. 테스트

### 단위 테스트 (Vitest)
- 매칭 엔진·정산 로직: **필수**
- 유틸 함수: 권장
- UI 컴포넌트: 핵심만

### E2E 테스트 (Playwright, 선택)
- 핵심 user journey (S1 차량 등록 → S4 송금 → S5 학생 접속)

### 테스트 작성 규칙
```typescript
// lib/matching/__tests__/approve.test.ts
import { describe, it, expect } from 'vitest'

describe('approve()', () => {
  it('FIFO 큐 1번째에서만 호출 가능', () => {
    // ...
  })

  it('잔여 자리 부족 시 propose_partial 호출', () => {
    // ...
  })
})
```

---

## 6. DB 마이그레이션 규칙

- 파일명: `YYYYMMDDHHMMSS_<설명>.sql`
- 한 번 적용된 마이그는 절대 수정 X (새 마이그로 보완)
- 운영 DB에 적용은 East_Star만 (Cowork으로)
- RLS 변경은 별도 마이그 + 충분한 테스트

---

## 7. 시크릿·보안

### 절대 금지
- `.env.local`을 commit
- service_role key, master 비번 등을 코드·문서에 평문
- 로그·콘솔에 개인정보 평문 출력

### 만약 실수로 commit했다면
```bash
# 1. 즉시 East_Star에 알림
# 2. 해당 시크릿 즉시 재발급 (Supabase·Firebase 콘솔에서)
# 3. git history 정리는 East_Star가
```

---

## 8. 의존성 추가 시

새 패키지 추가는 PR에 사유 명시:
- 왜 필요한가
- 대안 검토 (이미 있는 거로 가능한가)
- 라이선스 (AGPL·MIT 등 호환성)
- bundle size 영향 (`pnpm dlx bundle-phobia <패키지>`)

---

## 9. 문서 변경

- `docs/SPEC.md`는 정본 — 변경 시 East_Star 승인 + `docs/decisions/` 기록
- `CLAUDE.md` · `AGENTS.md` 변경 시 둘 다 동기화
- README·ONBOARDING은 자유롭게 PR

---

## 10. 행동 규약 (간단)

- 사람·AI 모두 존중
- 다른 사람 코드 비판 시 코드에 한정 (사람 X)
- 모르면 묻는 게 정상
- 사역과 코드의 균형 (사역 우선)

---

## 11. 빠른 참조

| 작업 | 명령 |
|---|---|
| 새 branch | `git checkout -b feat/<area>-<summary>` |
| 자주 사용 | `git pull origin main && git rebase main` |
| PR 생성 | `gh pr create` 또는 GitHub UI |
| CI 검증 | `pnpm typecheck && pnpm lint && pnpm test` |
| 빌드 | `pnpm build` |
| 개발 서버 | `pnpm dev` |

---

> 막히면 East_Star에게 카톡 또는 GitHub Issue.
