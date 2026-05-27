# Bus Cignal — 팀원 온보딩 가이드

> 환영합니다! 에이전틱 코딩 처음이신 분도 OK. 천천히 따라오세요.
> 막히면 팀장에게 카톡 / GitHub Issue로 질문.

---

## 0. 이 프로젝트는 무엇인가요?

CCC 전국 여름 수련회 때 **타지구 차량 자리 나눔**을 매끄럽게 만드는 웹 서비스입니다.
- 자세한 기획: `docs/SPEC.md` (정본, 1100줄)
- 외부 공유 요약: `docs/OVERVIEW.md`

먼저 `docs/OVERVIEW.md`를 가볍게 읽고 오시면 좋아요. 시스템이 뭘 하는지 감이 잡힙니다.

---

## 1. 사전 준비

### 1.1 도구 설치

| 도구 | 버전 | 설치 |
|---|---|---|
| Node.js | 20 LTS 이상 | https://nodejs.org |
| pnpm | 최신 | `npm install -g pnpm` |
| Git | 최신 | macOS: `brew install git` |
| GitHub CLI | 최신 | macOS: `brew install gh` (선택) |
| VS Code (또는 Cursor) | 최신 | https://code.visualstudio.com |

### 1.2 GitHub 접근

팀장에게 GitHub 사용자명을 알려주면 저장소 collaborator로 추가됩니다.

```bash
# 인증
gh auth login   # 또는 git config로 token

# 확인
gh auth status
```

### 1.3 IDE 확장
**VS Code 추천 확장**:
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)
- GitLens

**Cursor 사용 시**: 위 + `.cursor/rules` 자동 인식 (있다면).

---

## 2. 첫 셋업 (Day 1)

### 2.1 Clone

```bash
cd ~/projects  # 또는 본인 작업 폴더
gh repo clone Lumiere001/bus-cignal
cd bus-cignal
```

### 2.2 의존성 설치

```bash
pnpm install
```

### 2.3 환경 변수

`.env.local` 파일을 루트에 만드세요 (gitignored, 절대 commit X):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<팀장에게 받기>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<팀장에게 받기>

# Firebase (채팅용)
NEXT_PUBLIC_FIREBASE_CONFIG=<팀장에게 받기>

# 카카오맵
NEXT_PUBLIC_KAKAO_MAP_API_KEY=<팀장에게 받기>
```

> 시크릿은 1Password 공유 vault에 있습니다. 팀장에게 액세스 요청.

### 2.4 개발 서버 실행

```bash
pnpm dev
```

http://localhost:3000 접속해서 첫 화면이 뜨면 성공.

### 2.5 검증

```bash
pnpm typecheck   # TypeScript 타입 검사
pnpm lint        # ESLint
pnpm test        # 단위 테스트
pnpm build       # 빌드 가능한지 확인
```

전부 통과해야 PR 머지 가능.

---

## 3. AI 도구 사용법

### 3.1 Claude Code (CC)

**기본 흐름**:
1. 터미널에서 `claude` 명령으로 진입 (또는 `claude code`)
2. 자연어로 지시 — "Trip 등록 폼을 만들어줘"
3. AI가 파일 생성·수정 → 확인 → 적용

**중요 원칙**:
- 작업 시작 전 `CLAUDE.md` 읽도록 컨텍스트 제공 (자동으로 읽음)
- 한 번에 큰 기능 X — 작은 단위로 쪼개기
- 에러 발생 시 메시지 그대로 복사해서 AI에게
- 대화 길어지면 `/clear` 또는 새 세션
- 변경 검토하고 commit

### 3.2 Codex (OpenAI)

**기본 흐름**:
1. Codex에 진입
2. `AGENTS.md`를 자동으로 읽음 (같은 내용이 `CLAUDE.md`와 미러)
3. 자연어 지시 → 코드 생성

**팁**:
- 도메인 용어 (지구·간사·매칭·예약번호 등)는 SPEC 기반
- 코드 작성 후 `pnpm lint` `pnpm typecheck` 통과 확인

### 3.3 Cowork (Claude on Web/Desktop)

**적합한 작업**:
- Supabase 대시보드 조작 (마이그 실행·테이블 확인)
- Vercel 콘솔 (배포·env vars)
- GitHub UI에서 PR 리뷰
- 브라우저에서 UI 실시간 테스트
- 모바일 실기기 검증 (Cowork에서 화면 확인)

**자세한 활용법**: `COWORK.md`

### 3.4 Cursor

**기본 흐름**:
- 파일 열고 `Cmd+K` 또는 `Cmd+L`
- `.cursor/rules` (있다면) 자동 적용
- 컨벤션은 `CLAUDE.md` 따름

---

## 4. 작업 흐름 (PR 만들기까지)

### 4.1 작업 시작 전

```bash
git checkout main
git pull origin main
git checkout -b feat/<영역>-<요약>
# 예: feat/matching-fifo-queue
```

브랜치 네이밍은 `CONTRIBUTING.md` 참조.

### 4.2 개발

1. 변경 사항이 어느 도메인인지 확인 → `docs/SPEC.md` 해당 섹션 읽기
2. AI 도구로 코드 작성
3. 로컬에서 동작 확인 (`pnpm dev`)
4. 테스트 작성/통과 확인
5. `pnpm lint` `pnpm typecheck` 통과

### 4.3 Commit

```bash
git add <파일들>
git commit -m "feat(matching): partial offer 슬라이스별 데드라인 구현"
```

Conventional Commits 형식 (`CONTRIBUTING.md` §commit).

### 4.4 Push & PR

```bash
git push -u origin feat/<영역>-<요약>
gh pr create --title "..." --body "..."
```

또는 GitHub UI에서 PR 생성.

### 4.5 리뷰

- 팀장가 리뷰 → 변경 요청 또는 승인
- 추가 commit으로 변경 반영
- 승인 받으면 팀장가 머지

---

## 5. 자주 막히는 부분

### Q. `pnpm install` 안 됨
- Node.js 20 이상인지 확인 (`node --version`)
- 안 되면 `pnpm store prune && pnpm install`

### Q. 환경 변수가 안 잡힘
- `.env.local` 파일명 정확한지 (`.env.development.local` 아님)
- 변수 이름 앞에 `NEXT_PUBLIC_` 붙은 건 클라이언트에 노출되는 것
- 서버 전용은 `NEXT_PUBLIC_` 빼야 안전
- dev 서버 재시작 필요

### Q. Supabase 연결 안 됨
- URL·anon key 정확한지
- Supabase 프로젝트 paused가 아닌지 (Dashboard 확인)

### Q. Firebase 채팅 메시지가 안 보임
- 콘솔에 권한 에러 있는지
- Custom Token이 정상 발급됐는지 (Network 탭 확인)
- Firestore Security Rules 정상인지

### Q. CI에서 빌드 실패
- 로컬에서 `pnpm build` 통과 확인
- 환경 변수는 Vercel에 별도 설정 (로컬과 동기화)

### Q. PR 충돌
```bash
git checkout main
git pull
git checkout <my-branch>
git rebase main
# 충돌 해결 후
git rebase --continue
git push --force-with-lease
```

`--force` 말고 `--force-with-lease` 사용 (안전).

---

## 6. 도움 받는 법

| 상황 | 어디로 |
|---|---|
| 기획 의문 (왜 이렇게 했지?) | `docs/SPEC.md` 해당 섹션 → 그래도 모르면 팀장 |
| 코드·도구 문제 | AI 도구에 먼저 질문 → 해결 안 되면 GitHub Issue |
| 환경·접근 문제 | 팀장 카톡 |
| Cowork 활용 | `COWORK.md` |
| 긴급 (배포 사고 등) | 팀장 카톡 즉시 |

---

## 7. 첫 주 추천 학습 순서

1. **Day 1**: `docs/OVERVIEW.md` 읽기 + 셋업 + 첫 화면 띄우기
2. **Day 2**: `docs/SPEC.md` §1~§3 (배경·페르소나·시나리오)
3. **Day 3**: `docs/SPEC.md` §4~§6 (사이트맵·화면·DB)
4. **Day 4**: `CLAUDE.md` + `CONTRIBUTING.md` 정독
5. **Day 5**: 가장 작은 feature 하나 잡고 PR 만들어보기 (예: 새로운 UI 컴포넌트 추가)

---

## 8. 마음가짐

- **모르면 물어보기** — 혼자 헤매는 시간이 가장 비싸요
- **작은 PR** — 100줄 PR 5개 > 500줄 PR 1개
- **자주 push** — 하루 작업 끝나면 push (backup·동기화)
- **테스트 작성** — 매칭·정산은 특히 — 나중에 본인을 살려줍니다
- **컨벤션 지키기** — AI가 도와주지만 사람이 한 번 더 확인
- **사역과 코드의 균형** — 사역이 우선, 코드는 도구

> 함께 만들어요 🙏
