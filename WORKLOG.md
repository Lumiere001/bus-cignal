# Bus Cignal — Work Log

> **AI 자동 갱신 파일.** 사람이 직접 편집 X.
> AI가 작업 시작 시 자동으로 읽고, 끝낼 때 자동 갱신.
> 같은 컴퓨터에서 여러 도구(CC·Cowork·Chat) 이동 중 사용 → 세션 손실 방지 핵심.

---

## 🔄 현재 작업 (Active)

- **상태**: 외부 도구 셋업 **대기 중** (다음 세션에서 진행)
- **마지막 세션 종료**: 2026-05-27 23:30 (세션 포화)

### 다음 세션 시작 방법 (사용자 가이드)

```bash
# 1. 현재 세션과 동일 위치에서 CC 시작
cd /Users/east_star/LIFE
claude

# 2. 첫 메시지 (한 마디만)
"작업 이어가자"
# 또는 "Bus Cignal 이어가자" / "외부 셋업 시작하자" / "다음 단계"
```

→ CC가 자동으로 모든 컨텍스트 복원 + 다음 단계 안내. 별도 설명 불필요.

### 다음 세션 첫 액션 (CC 자동 수행):
  1. CC가 자동으로 이 WORKLOG·SESSION-HANDOFF·CHANGELOG 읽음
  2. **`.team-role` 자동 읽기**:
     ```bash
     cat /Users/east_star/projects/bus-cignal/.team-role 2>/dev/null
     # 값: team-lead (예상)
     ```
  3. 팀장 확인 (vault 존재):
     ```bash
     ls /Users/east_star/LIFE/projects/bus-cignal/team-lead-prompts/ 2>/dev/null
     ```
  4. vault 존재 = 팀장 머신 → 외부 셋업 진행 가능
  5. **팀장 vault**의 `team-lead-prompts/setup-README.md` 읽고 5단계 인지
  6. **사용자에게 "외부 도구 셋업 시작할까요? Cowork 프롬프트 5개 순차 제공"** 안내
  7. 사용자 OK → vault `team-lead-prompts/setup-1-supabase.md`부터 제공
  8. 사용자가 Cowork에서 진행 → 키 받음 → 1Password 저장
  9. CC에 결과 보고 → WORKLOG 갱신 → 다음 setup
  10. 5단계 완료 후 → Foundation Phase 1·2·3 진입

- **현재 위치**: `~/projects/bus-cignal/`
- **GitHub**: https://github.com/Lumiere001/bus-cignal (private, push 됨)

---

## 📌 외부 도구 셋업 (5단계, 다음 세션에서 진행)

| # | 작업 | 도구 | 상태 |
|---|---|---|---|
| 1 | Supabase 프로젝트 (Seoul) | Cowork | ⏳ 대기 |
| 2 | Firebase + Firestore + FCM | Cowork | ⏳ 대기 |
| 3 | 카카오 개발자센터 앱 | Cowork | ⏳ 대기 |
| 4 | Vercel 프로젝트 + GitHub 연동 + env vars | Cowork | ⏳ 대기 |
| 5 | 마스터 비번 + bcrypt hash | CC + 1Password | ⏳ 대기 |

프롬프트 파일: **팀장 vault** `~/LIFE/projects/bus-cignal/team-lead-prompts/setup-1~5-*.md`
(repo에는 없음 — 팀장 전용)

---

## 🚀 Foundation 진입 조건 (외부 셋업 5/5 완료 후)

다음 순서로 진행:

### Phase 1 — 외부 의존성 없는 부분 (1~3일)
- Next.js 15 스캐폴드 + TypeScript strict + Tailwind
- shadcn/ui 초기 + Pretendard 폰트
- 33개 페이지 placeholder 라우팅
- 디자인 시스템 base (색상·spacing)
- CI 설정 (GitHub Actions: typecheck·lint·test·build)
- ESLint·Prettier 설정
- CODEOWNERS

### Phase 2 — 외부 키 받은 후 (3~5일)
- Supabase 클라이언트 (server/client/types)
- Google OAuth 미들웨어 (operator)
- 마스터 비번 인증 미들웨어 (/admin/login)
- DB 마이그 1차 (12개 테이블 + RLS) + seed (52개 지구)
- Firebase 클라이언트 + Custom Token 발급 API
- 카카오맵 SDK 통합 + 지오코딩
- PWA 셋업 (next-pwa + manifest + sw + FCM)

### Phase 3 — 완성 (1~3일)
- Playwright E2E 스캐폴드 (S1·S4·S5 + iOS 푸시)
- Sentry 통합
- Vercel 배포 동작 확인

### 팀원 초대 시점
**Foundation Phase 3 완료 후** = 가장 안전 (인증·DB·라우팅·CI 다 동작 시점).

### ★ 팀원 초대 직전 — AI가 만들어야 할 산출물

Foundation 끝나고 팀원 초대 직전에 CC가 만들어야 할 것:

1. **`docs/TEAM-INVITE-MESSAGE.md`** — 팀원에게 카톡으로 보낼 안내 멘트
   - 환영 인사
   - GitHub repo 링크 + collaborator 수락 안내
   - 셋업 가이드 (clone·`.team-role`·로컬 Supabase·`.env.local`)
   - 본인 분담 영역 명시 (팀원 1·2 각각 다른 멘트)
   - 첫 작업 추천 (워밍업 PR)
   - 막힐 때 어디 물어볼지

2. **`docs/COLLABORATION-GUIDE.md`** — 팀원끼리 어떻게 작업하는지
   - 시스템 설계 요약 (어떻게 세팅했는지)
   - WORKLOG·SESSION-HANDOFF 자동화 활용법
   - `.team-role` 시스템
   - `team-lead-prompts/`는 본인에게 없음 (팀장 vault)
   - 팀원 간 충돌 방지 (분담대로)
   - PR 흐름 (작은 PR·매일 main rebase)
   - 머지 권한은 팀장만

3. **`docs/TEAM-WARNINGS.md`** — 주의사항 모음
   - 절대 X: main 직접 push, `.env.local` commit, 운영 DB 마이그 적용
   - 본인 분담 외 영역 수정 시 팀장 합의
   - 매칭 엔진·정산·RLS·Firestore Rules = `core` 라벨 사전 합의
   - 시크릿 의심 시 즉시 멈춤
   - PR 300줄 이하 권장
   - 자주 main rebase

4. **각 팀원별 맞춤 멘트 2개** (팀원 1·팀원 2 분담 명시)

→ Foundation Phase 3 완료 시점에 CC가 위 3개 문서 + 멘트 작성. 사용자가 카톡으로 팀원에게 전달.

### 초대 전 사용자(팀장)가 할 일
- 팀원 GitHub collaborator 추가
- 1Password 공유 vault 접근권한 (dev 키만)
- 카톡으로 안내 멘트 전달 (위 1번)
- 팀원이 셋업 완료 알릴 때 확인

---

## ⏳ 미해결 이슈

- 없음 (기획 모든 결정 완료)

---

## ✅ 최근 완료 (Recent)

### 2026-05-27 23:00 — v1.0 Confirmed Final + 도구 분담·세션 시스템
- SPEC v1.0 Confirmed Final 최종본 (vault README + repo docs/SPEC.md)
- OVERVIEW 디테일 보강 (팀·간사 스팩 파악용, 18개 섹션)
- 로컬 Supabase 셋업 가이드 ONBOARDING에 추가 (Docker)
- `docs/AI-PROMPTS/setup-1~5-*.md` 5개 + setup-README 작성
- WORKLOG·SESSION-HANDOFF 다음 세션 인계 정보 명시
- 모든 결정 사항 반영:
  - 마스터 = 비번 only
  - 간사 가입 시 location 등록 → 출발지 미지정 패널티 제거
  - 부분 매칭 = 우선순위 자동
  - K2 자리 풀릴 때마다 알림
  - 학생 자의 취소 + "환불 각 지구 문의"
  - PWA V1 도입 (옵션 C)
  - 티켓 BUS-XXXX
  - 익명화 매일 새벽 3시
  - 도구 분담 + 세션 손실 방지

### 2026-05-27 17:00 — v1.0 Confirmed (1차)
- 17개 안건 결정, 우선순위 매칭 도입
- "East_Star" → "팀장" 일괄 교체

### 2026-05-26 — 기획 초안 ~ v0.3
- v0.1 → v0.2 부분 매칭 학생 선택 → v0.3 슬라이스 실시간
- 팀원 기획안(이유성·김도영) 검토 후 본 안 채택
- GitHub repo `Lumiere001/bus-cignal` (private) 생성
- 팀원 문서 트리오 (CLAUDE·AGENTS·ONBOARDING·CONTRIBUTING·COWORK)

---

## 🛠 AI 자동 갱신 규칙

### 작업 시작 시 (사용자 의도 감지)
사용자가 "작업 시작", "이어서", "다시" 같은 의도 표하면 AI 자동:
1. `git fetch origin main`
2. `git log HEAD..origin/main --oneline`
3. `cat CHANGELOG.md | head -50` — Unreleased 섹션
4. `cat WORKLOG.md` ← **이 파일**
5. `cat docs/SESSION-HANDOFF.md` ← 인계 정보
6. SPEC.md / CLAUDE.md diff 분석
7. 본인 작업 영역 영향 평가
8. **사용자에게 어디서 끊겼는지 + 다음 액션 한 줄 보고**

### 작업 종료 시 (사용자 의도 감지)
사용자가 "끝내자", "Cowork으로", "다음에" 같은 의도 표하면 AI 자동:
1. 이 파일 `🔄 현재 작업` 섹션 갱신
2. 완료된 것 → `✅ 최근 완료`
3. 미해결 → `⏳ 미해결 이슈`
4. 도구 전환이면 → `docs/SESSION-HANDOFF.md` 자동 작성 + 복사용 프롬프트 제공
