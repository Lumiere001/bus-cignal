# Bus Cignal — 역할 분담·권한 모델

> **누가 무엇을 할 수 있는지** 명확히. 사람·AI 둘 다 참조.
> AI는 작업 시작 시 이 문서를 자동으로 읽고 사용자 권한 안에서만 동작.

---

## 1. 역할 3종

### 🎯 팀장 (Team Lead) — 1명
- 현재: CCC IT 사역부 운영 책임자 (East_Star)
- 작업 머신: vault `~/LIFE/projects/bus-cignal/`가 있는 컴퓨터

### 👥 팀원 (Team Member) — 2명
- 분담:
  - 팀원 1 = 운영자·마스터 UI (Trip·매칭 큐·정산·관리자 화면)
  - 팀원 2 = 학생·채팅 (예약번호·대시보드·카카오맵·Firestore)
- 작업 머신: GitHub repo만 clone, vault 없음

### 🤖 AI (CC / Cowork / Claude Chat)
- 사용자 권한 안에서만 동작
- 머신에 vault 있으면 = 팀장 머신, 없으면 = 팀원 머신으로 판단

---

## 2. 작업별 권한 매트릭스

### 🔴 팀장만 (Team Lead Only)

| 작업 | 이유 |
|---|---|
| 외부 도구 프로젝트 생성 (Supabase·Firebase·Vercel) | 시크릿 발급·관리 권한 |
| 운영 DB 마이그레이션 적용 | 운영 데이터 영향 |
| Vercel 환경 변수 변경 | 운영 시크릿·재배포 |
| 마스터 비밀번호 생성·rotation | 마스터 권한 |
| GitHub branch 보호 변경 | 보안 정책 |
| GitHub collaborator 추가·해제 | 접근 통제 |
| 시크릿 1Password vault 관리 | 보안 |
| 간사 가입 승인·권한 해제 | 운영 권한 (시스템 내) |
| 운영 phase 전환·점검 모드 | 시스템 정책 |
| 매칭 거절 패턴 모니터링·개입 | 운영 |
| 출시·배포 결정 | 마스터 권한 |
| `main` 브랜치 머지 (PR approve) | 코드 게이트 |
| **vault `team-lead-prompts/` 사용** | 위 작업용 |

### 🟡 팀장 + 팀원 (공통)

| 작업 | 비고 |
|---|---|
| 본인 feature 코드 작성 (분담대로) | 단위 테스트 함께 |
| PR 생성·셀프 리뷰 | 머지는 팀장만 |
| 로컬 dev DB 마이그 작성·테스트 | `supabase start` |
| 디자인 mock 생성 (Claude Chat) | 본인 담당 화면 |
| UI copy 작성·검토 | |
| 버그 보고 (Cowork → CC) | 본인 작업 영역 |
| 채팅 컴포넌트 구현 | 팀원 2 담당 |
| 단위·통합 테스트 작성 | 본인 코드에 |
| 문서 업데이트 (`ONBOARDING`·`CHANGELOG` 등) | |

### 🟢 팀원만 (해당 없음)

팀장은 모든 권한을 가지므로 "팀원만 할 수 있는 작업"은 없음.

---

## 3. 파일 접근 권한

### vault (`~/LIFE/projects/bus-cignal/`) — 팀장만
- `README.md` (v1.1 정본)
- `OVERVIEW.md` (외부 공유용 원본)
- `REGIONS.md`, `data/regions.csv`
- **`team-lead-prompts/setup-*.md`** ← 외부 셋업
- `TEAM-PLANS-REVIEW.md` (의사결정 history)

### repo (`~/projects/bus-cignal/`) — 누구나 (GitHub collaborator)
- 코드 전체
- `docs/SPEC.md` (vault 사본)
- `docs/OVERVIEW.md`, `docs/REGIONS.md`
- `CLAUDE.md`, `AGENTS.md`, `ONBOARDING.md`, `CONTRIBUTING.md`, `COWORK.md`
- `WORKLOG.md`, `docs/SESSION-HANDOFF.md`
- `docs/AI-PROMPTS/` (공통 프롬프트만, setup 제외)
- `CHANGELOG.md`

### ⚠️ 카카오맵 키 = 예외 (팀원이 등록·제공)
- 팀장의 **비즈니스 주체 충돌**로 카카오맵 고급 권한을 팀장이 못 받음.
- → **팀원2(또는 별도 사업주체를 가진 팀원)가 본인 카카오 개발자 계정으로 앱을 등록**하고 JS 키·REST 키를 제공.
- 코드는 env var(`NEXT_PUBLIC_KAKAO_MAP_API_KEY`·`KAKAO_REST_API_KEY`) 기준이라 **키 출처와 무관하게 동작**.
- 그 외 외부 도구(Supabase·Firebase·Vercel) 생성은 팀장.

### 시크릿 (1Password / 팀 채널)
- **팀장 vault**: 운영 시크릿 (service_role·Firebase Admin·MASTER_PASSWORD 등)
- **공유**: 팀원용 dev 키 (dev Firebase 웹 config). **카카오 키는 팀원2가 제공**. (1Password 없으면 팀 노션 등 — 단 진짜 시크릿은 평문 공유 주의)

---

## 4. AI 행동 규칙 (CC·Cowork·Chat 공통)

### 작업 시작 시 자동 판단 (2단계)

**Step 1: `.team-role` 파일 읽기**
```bash
cat /Users/east_star/projects/bus-cignal/.team-role 2>/dev/null
```

| 값 | 역할 | Step 2 필요? |
|---|---|---|
| `team-lead` | 팀장 | ⭕ vault 확인 |
| `team-member-1-operator` | 팀원 1 (운영자·마스터 UI) | ❌ 본인 분담 작업 |
| `team-member-2-passenger` | 팀원 2 (학생·채팅) | ❌ 본인 분담 작업 |
| (파일 부재) | 미지정 | 사용자에 역할 묻기 |

**Step 2: 팀장 확인 (`.team-role` = team-lead일 때만)**
```bash
ls /Users/east_star/LIFE/projects/bus-cignal/team-lead-prompts/ 2>/dev/null
```
- 존재 → 진짜 팀장 머신. 모든 작업 + vault 접근.
- 부재 → `.team-role`은 팀장이지만 vault 없음. **이상 상황** — 사용자에 확인 ("vault 없는데 팀장 표시? 환경 확인 필요").

### 팀원 머신에서 팀장 작업 요청 시
```
"이 작업은 팀장 전용입니다 (외부 인프라·시크릿 관리).
 팀장에게 요청해 주세요.
 본인 분담:
 - 팀원 1: 운영자·마스터 UI (Trip·매칭 큐·정산·관리자)
 - 팀원 2: 학생·채팅 (예약번호·대시보드·카카오맵·Firestore)"
```

### 팀원이 본인 분담 외 영역 수정 시도
```
"이 영역은 [팀원 N {담당}] 책임입니다.
 같이 작업하려면 팀장 합의 + 명시 진행 의사 필요.
 진행할까요?"
```

### 팀장 머신에서 작업 시
- `.team-role` = team-lead + vault 존재 확인
- `team-lead-prompts/` + 공통 `AI-PROMPTS/` 모두 접근
- 모든 분담 영역 + 외부 셋업·운영 작업 가능

### .team-role 파일 부재 시 (첫 사용)
AI 안내:
```
"어떤 역할이신가요?
- 팀장 (운영 책임자) — vault 접근 + 모든 작업
- 팀원 1 (운영자·마스터 UI) — Trip CRUD·매칭 큐·정산·마스터 화면
- 팀원 2 (학생·채팅) — 예약번호·학생 대시보드·카카오맵·Firestore 채팅

답해주시면 .team-role 파일에 자동 저장하고 이어가겠습니다."
```

사용자 답변 후:
```bash
echo "team-member-1-operator" > .team-role  # 예시
```

---

## 5. PR 머지 규칙

- `main` 직접 push X (브랜치 보호)
- PR 머지 = 팀장 approve 필수
- CI (typecheck·lint·test·build) 통과 필수
- 매칭 엔진·정산·RLS·Firestore Rules 변경 = `core` 라벨 + 팀장 명시 합의

---

## 6. 시크릿 분배 절차

### 팀장 → 팀원 1·2
1. 팀원 GitHub collaborator 추가
2. 팀원 1Password "Bus Cignal Team Dev" vault 접근권한 (운영 키 X)
3. 팀원이 본인 머신에서:
   - `gh repo clone Lumiere001/bus-cignal`
   - `supabase start` (로컬 Supabase Docker)
   - 1Password에서 dev 키 받아 `.env.local` 작성
   - `pnpm install && pnpm dev`

### 팀원 → 팀장
시크릿 관련 요청 시 1Password 또는 안전한 채널로만. 절대 채팅 X.

---

## 7. 향후 변경 시

이 문서 변경 = 팀장 명시 승인.
변경 사유 = `docs/decisions/` 또는 CHANGELOG에 기록.

---

## 관련 문서

- `CLAUDE.md` — AI 컨텍스트
- `AGENTS.md` — AI 컨텍스트 미러
- `CONTRIBUTING.md` — commit·PR 규칙
- `COWORK.md` — Cowork 활용
- vault `team-lead-prompts/` — 팀장 전용 (팀장만)
