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

### 2.1a 본인 역할 표시 (★ 중요)

```bash
cp .team-role.example .team-role
# .team-role 파일 열고 본인 역할 한 줄 입력
# 또는 한 번에:
echo "team-member-1-operator" > .team-role
# 또는 echo "team-member-2-passenger" > .team-role
```

가능한 값:
- `team-lead` — 팀장 (vault 접근 가능)
- `team-member-1-operator` — 팀원 1 (운영자·마스터 UI)
- `team-member-2-passenger` — 팀원 2 (학생·채팅)

→ AI가 작업 시작 시 자동으로 읽고 본인 담당 영역 인지.
→ `.team-role` 파일은 gitignored. 절대 commit X.

### 2.2 의존성 설치

```bash
pnpm install
```

### 2.3 로컬 Supabase Dev DB (Docker 기반)

운영 DB와 격리된 본인 머신의 dev DB를 띄웁니다. 실수해도 운영에 영향 X.

**사전 조건**: Docker Desktop 설치 (https://www.docker.com/products/docker-desktop)

```bash
# Supabase CLI 설치
brew install supabase/tap/supabase
# 또는: npm install -g supabase

# 프로젝트 디렉토리에서
cd ~/projects/bus-cignal
supabase start   # 첫 실행 시 ~5분 (Docker 이미지 다운로드)
```

성공하면 출력에서 다음 정보 받음:
```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
JWT secret: ...
anon key: eyJ...
service_role key: eyJ...
```

**자주 쓰는 명령**:
```bash
supabase status   # 동작 중인지 확인
supabase stop     # 종료 (디스크 절약)
supabase db reset # DB 초기화 (마이그+seed 재실행)
supabase migration new <name>  # 새 마이그 파일 생성
```

**Studio 접속**: http://localhost:54323 → 테이블·SQL·RLS 확인

### 2.4 환경 변수

`.env.local` 파일을 루트에 만드세요 (gitignored, 절대 commit X):

```bash
# Supabase (로컬 dev)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase start 출력의 anon key>
SUPABASE_SERVICE_ROLE_KEY=<출력의 service_role key>

# Firebase (채팅·푸시) - 팀장이 1Password 또는 안전한 채널로 공유
NEXT_PUBLIC_FIREBASE_API_KEY=<...>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<...>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<...>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<...>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<...>
NEXT_PUBLIC_FIREBASE_APP_ID=<...>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<...>
FIREBASE_ADMIN_PRIVATE_KEY=<...>
FIREBASE_ADMIN_CLIENT_EMAIL=<...>

# 카카오맵
NEXT_PUBLIC_KAKAO_MAP_API_KEY=<팀장에게 받기>
KAKAO_REST_API_KEY=<팀장에게 받기>

# 마스터 비번 (개발 환경에서는 본인이 정함)
MASTER_PASSWORD_HASH=<bcrypt hash, 본인 dev용>

# 앱 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Firebase·카카오·마스터 비번 등은 팀장이 운영용 키 별도 1Password에 보관. 팀원은 dev 키만 사용.

### 2.5 개발 서버 실행

```bash
pnpm dev
```

http://localhost:3000 접속해서 첫 화면이 뜨면 성공.

### 2.6 검증

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

## 5a. 세션 손실 방지 (이동 중 작업하는 환경)

같은 컴퓨터에서 여러 도구 이동·세션이 자주 바뀌어도 컨텍스트 손실 X.

### 핵심 파일 3개

| 파일 | 용도 | 갱신 |
|---|---|---|
| `WORKLOG.md` | 현재 작업·다음·미해결 | AI 자동 |
| `docs/SESSION-HANDOFF.md` | 도구 전환 시 인계 | AI 자동 |
| `docs/AI-PROMPTS/*.md` | 도구 전환 프롬프트 템플릿 | 팀장·AI |

### 작업 시작 시 (사람이 할 일 0)
사용자가 "작업 시작" 표하면 AI가 자동:
- WORKLOG 읽어서 어디서 끊겼는지 파악
- SESSION-HANDOFF 읽어서 다른 도구에서 인계 받은 거 있는지
- CHANGELOG Unreleased 확인
- 변경 영향 평가 → 사용자 보고

### 도구 전환 시 (사람이 할 일 0)
사용자가 "Cowork으로 넘기자" 표하면 AI가 자동:
- WORKLOG 갱신
- SESSION-HANDOFF 작성
- AI-PROMPTS 템플릿 채워서 **복사용 코드 블록** 제공
- 사용자는 그 블록 복사해서 다음 도구에 paste

### 도구별 분담

| 도구 | 잘하는 것 |
|---|---|
| Claude Code (CC) | 코드·터미널·git·DB SQL·테스트 |
| Cowork | Supabase·Vercel·Firebase·GitHub UI GUI |
| Claude Chat | UI 디자인 mock·copy·기획 논의 |

자세한 활용법: `COWORK.md`

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
