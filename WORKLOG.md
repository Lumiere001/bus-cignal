# Bus Cignal — Work Log

> **AI 자동 갱신 파일.** 사람이 직접 편집 X.
> AI가 작업 시작 시 자동으로 읽고, 끝낼 때 자동 갱신.
> 같은 컴퓨터에서 여러 도구(CC·Cowork·Chat) 이동 중 사용 → 세션 손실 방지 핵심.

---

## 🔄 현재 작업 (Active)

- **상태**: 외부 셋업 4.7/5 + Phase 1 ✅ + **Phase 2 진행 중** (`feat/foundation-phase-2`): P2-1 환경·P2-2 DB·P2-3 클라이언트·P2-4 마스터비번 ✅ / **간사 인증(CCC)·Firebase·PWA 남음**
- **🆕 v1.1 기획 개정 (2026-05-30, 간사 피드백)**: ① 간사 = **CCC 로그인** (Google OAuth 폐기) ② 매칭 = 시각순 정렬 + 간사 **수동 선택** (FIFO 강제·자동 부분/후속매칭·자동 거절 제거, priority=힌트) ③ 송금 = **자동 만료 폐지** → 소프트 리마인더 + 수동 [자리 풀기] ④ 학생·간사 PWA = **옵트인** ⑤ 이메일·성별 **미수집** ⑥ 지구 내 차량관리 = V1.5. → `docs/SPEC.md`·`docs/OVERVIEW.md` v1.1 반영 완료, vault 사본 동기화.
- **다음 단계 (P2-5 간사 인증 = CCC 로그인)**: ⛔ **CCC IT 답 대기** — 신원 전달 방식(A 서명토큰 / B 일회용코드 / C OIDC) 확정 필요. 그 전까지 완료: 마이그(`20260530000000_ccc_login_operators.sql` = `operators.google_uid`→`ccc_id` + `campus`·`ccc_role`)·세션 골격(`lib/auth/operator-session.ts`)·검증 스텁(`lib/auth/ccc.ts`)·`/login` placeholder·types·.env.example. **방식 확정 후**: `verifyCccToken` 구현 → `/login` 연동 → 미들웨어 `/operator` 가드 → RLS(앱레이어). 마이그는 Cowork이 Supabase 적용 + 타입 재생성.
- **로컬 Supabase 가동 중** (`supabase stop`으로 중지 가능, 재개는 `supabase start`)
- **마지막 세션 종료**: 2026-05-28 (Cowork — 비즈니스 정보 심사 신청 후 검색으로 카카오 정책 재확인 → 전략 변경 검토)
- **사용자 대기 중 (외부 합의)**: 신의 악단(앱 1442060) 영구 삭제 가능 여부 = 교수님 합의 필요. 신의 악단 = 학교 프로젝트로 만든 앱, 사용자 단독 결정 불가.

### ⚠️ 카카오맵 전략 재검토 (2026-05-28 검색 결과)

카카오 데브톡 직원 답변 2건 ([149625](https://devtalk.kakao.com/t/on/149625), [149685](https://devtalk.kakao.com/t/topic/149685)) 분석:

> "카카오맵 추가 권한은 해당 권한을 이미 소유한 다른 앱과 **비즈니스 주체가 다르고 무관한 서비스인 경우에만** 추가 부여" (woody.ho, 카카오)

우리 케이스:
- 비즈니스 주체: 같음 (둘 다 팀장 본인) ❌
- 서비스 무관: ✅ (음악 vs 차량 매칭)
- **두 조건 모두 충족 필요 → 추가 기능 신청해도 반려될 가능성 높음**

### 새 전략 (사용자 합의 후)

1. **신의 악단 영구 삭제** (교수님 합의 필요) → "이미 권한을 갖고 있는 다른 앱" 자체를 없앰
2. Bus Cignal 카카오맵 [상태] ON 토글 시도
3. 풀리면 = 케이스 A 즉시 활성화 (이미 제출한 비즈니스 정보 심사도 무효화/대기 무관)
4. 안 풀리면 = 카카오 내부 cache·history가 남아있는 경우. 데브톡 문의 또는 추가 기능 신청 흐름 복귀

### 이미 제출된 작업 (유효)
- 비즈니스 정보 심사 (영업일 3~5일 대기) — 신의 악단 삭제 + 토글 ON 성공 시 무관해짐
- Vercel 임시 랜딩 배포 — Foundation Phase 2까지 유지

**다음 단계 진입 조건**: 사용자가 교수님 합의 결과 알려주면 새 전략 실행

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
  6. **사용자에게 "외부 셋업 3/5 카카오부터 이어서 진행할까요?"** 안내
     (1/5 Supabase + 2/5 Firebase 완료)
  7. 사용자 OK → vault `team-lead-prompts/setup-3-kakao.md` 제공
  8. 사용자가 Cowork에서 진행 → 키 받음 → 1Password "카카오 · bus-cignal" item 저장
  9. CC에 결과 보고 → WORKLOG 갱신 → 다음 setup (4/5 Vercel)
  10. 5단계 완료 후 → Foundation Phase 1·2·3 진입

- **현재 위치**: `~/projects/bus-cignal/`
- **GitHub**: https://github.com/Lumiere001/bus-cignal (private, push 됨)

---

## 📌 외부 도구 셋업 (5단계, 다음 세션에서 진행)

| # | 작업 | 도구 | 상태 |
|---|---|---|---|
| 1 | Supabase 프로젝트 (Seoul) | Cowork | ✅ 완료 (2026-05-27) |
| 2 | Firebase + Firestore + FCM | Cowork | ✅ 완료 (2026-05-28) |
| 3 | 카카오 개발자센터 앱 | Cowork | 🟡 심사 중 (2026-05-28) — 앱·키·도메인·비즈 앱 ✅ / 비즈니스 정보 심사 신청 완료 (영업일 3~5일 대기) / 카카오맵 권한 신청 대기 |
| 4 | Vercel 프로젝트 + GitHub 연동 + env vars | Cowork | 🟡 부분 완료 (2026-05-28) — 임시 랜딩 배포 ✅ / Foundation Phase 2에서 env vars 입력 예정 |
| 5 | 마스터 비번 + bcrypt hash | CC + vault _secrets | ✅ 완료 (2026-05-28) |

프롬프트 파일: **팀장 vault** `~/LIFE/projects/bus-cignal/team-lead-prompts/setup-1~5-*.md`
(repo에는 없음 — 팀장 전용)

---

## 🚀 Foundation 진입 조건 (외부 셋업 5/5 완료 후)

다음 순서로 진행:

### Phase 1 — ✅ 완료 (2026-05-28, PR #1 squash 머지)
- Next.js 16 스캐폴드 + TypeScript strict + Tailwind
- shadcn/ui 초기 + Pretendard 폰트
- 32개 라우트 placeholder 라우팅
- 디자인 시스템 base (색상·spacing)
- CI 설정 (GitHub Actions: typecheck·lint·test·build)
- ESLint·Prettier 설정
- CODEOWNERS

### Phase 2 — 외부 키 받은 후 (3~5일)
- Supabase 클라이언트 (server/client/types)
- 간사 인증 미들웨어 (**CCC 로그인** + 자체 세션, ⛔ CCC IT 신원 전달 방식 대기 — 그동안 dev 세션 우회로 개발)
- 마스터 비번 인증 미들웨어 (/admin/login)
- DB 마이그 1차 (12개 테이블 + RLS) + seed (53개 지구)
- Firebase 클라이언트 + Custom Token 발급 API
- 카카오맵 SDK 통합 + 지오코딩
- PWA 셋업 (next-pwa + manifest + sw + FCM)

### Phase 3 — 완성 (1~3일)
- **dev 로그인 우회 + seed 테스트 데이터** (간사·Trip·신청·매칭·예약번호) — 팀원이 화면 테스트 가능하게 (v1.1 추가)
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

→ ✅ (2026-05-30) `docs/TEAM-INVITE-MESSAGE.md` 생성 — 팀원1·2 카톡 + 받을자료 체크리스트.
   COLLABORATION-GUIDE / TEAM-WARNINGS 내용은 `ROLES.md`·`docs/GIT-WORKFLOW.md`·`docs/TEAM-TASKS.md`·`CONTRIBUTING.md`가 커버(별도 파일 생략).

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

### 2026-05-28 — Foundation Phase 2 진행 (P2-1 ~ P2-4 마스터비번)
- **P2-1** 로컬 Supabase 환경: Docker·`supabase init`·`.env.local` (Supabase 로컬키 + vault Firebase/카카오/마스터키)
- **P2-2** DB 마이그 1차: 12테이블 + RLS 골격(regions·region_locations 공개읽기) + 53지구 seed + 타입생성. 로컬 검증 통과
- **P2-3** SSR 클라이언트 4종 (browser·server·middleware·admin) + 루트 세션 미들웨어
- **P2-4** 마스터 비번 인증 ✅: `/admin/login` + jose JWT 세션 24h + 5회 1h 잠금 + `/admin` 미들웨어 보호. bcrypt 호환 검증
- `feat/foundation-phase-2` 4 commit (453b6ee·a00356d·72b85bb)
- ⏳ 남음: **Google OAuth(operator)** = Cowork 외부설정 → P2-5 Firebase → P2-6 PWA  *(→ v1.1 정정: Google OAuth 폐기, CCC 로그인으로 전환)*
- ⚠️ RLS 세밀 정책(operator/passenger)은 OAuth 인증 스킴 확정 후 별도 마이그  *(→ v1.1: CCC 로그인 + 자체 세션 스킴, 앱레이어 강제)*

### 2026-05-28 — Foundation Phase 1 완료 (PR #1 squash 머지, main 2c16ad0)
- Next.js **16** + React 19 + TS strict + Tailwind **v4** + ESLint 9 + Prettier 3
- shadcn/ui (Base UI 기반) + Pretendard (dynamic-subset) + 브랜드 색상 4종 (Blue·Green·Yellow·Red, light/dark)
- SPEC §4 폴더 구조 (lib·components·supabase·tests) + 33 라우트 placeholder + not-found
- vitest 3 (+vite 6, .mts config) + GitHub Actions CI (typecheck·lint·test·build + gitleaks) + CODEOWNERS
- CI 그린 통과 (verify + secret scan). 5 commit → squash 머지
- ⚠️ **버전 메모**: SPEC "Next.js 16" → **16** 갱신 필요 (출시 일정도 7월보다 앞당겨짐 반영)
- ⚠️ **Vercel**: 임시 랜딩(정적) 설정이라 Next 앱 preview 배포 fail — 카카오 승인 후 main production 전환 시 Next.js 재설정 필요

### 2026-05-28 — 외부 셋업 5/5: 마스터 비번 + bcrypt hash (CC, vault 보관)
- 24자 랜덤 비번 (`openssl rand -base64 18`) + bcrypt **cost 12** hash
- round-trip `checkpw` 검증 OK
- `_secrets/setup-5-master-password.md` (chmod 600, gitignored) — 1Password 대신 vault 보관 (사용자 선택)
- hash → Vercel env `MASTER_PASSWORD_HASH` (Foundation Phase 2 / setup-4 2차에 입력 예정)
- 카카오 블로커 대기 중 선(先)처리 (카카오 무관 작업)

### 2026-05-28 — 카카오 비즈니스 정보 심사 신청 (재신청)
- 신청 폼 입력:
  - 카테고리: 자동차/교통수단 (자동)
  - 운영 중인 웹사이트 URL: **`https://bus-cignal.vercel.app`**
  - 서비스 화면 첨부: `bus-cignal-overview.pdf` (OVERVIEW.md를 CC가 PDF 변환, 18개 섹션)
  - 추가 정보: 서비스 설명 + 카카오맵 사용 목적 + 랜딩 페이지 URL + PDF 안내 명시
- 신청 결과: **● 심사 중** (영업일 3~5일 대기, 카카오 메일로 결과 통지)
- 카카오 메일 = 팀장 카카오 계정 등록 메일 = `kd100150@gmail.com` 추정
- 승인 시 다음 작업: 카카오맵 추가 기능 신청 → 카카오 승인 대기 (별도 1~2일)

### 2026-05-28 — 외부 셋업 4/5 부분: Vercel 임시 랜딩 페이지 배포 완료
- Vercel Project: **bus-cignal** (lumiere001's projects · Hobby plan)
- 대시보드: https://vercel.com/lumiere001s-projects/bus-cignal
- **Production 배포 도메인: `https://bus-cignal.vercel.app`** ✓ (카카오 JS SDK 도메인 등록과 일치 — 추가 등록 불필요)
- Production Branch: `temp/landing-for-kakao` (main이 아닌 임시 브랜치, Foundation 진입 전까지 유지)
- Framework: Other (정적 HTML, vercel.json buildCommand:null)
- Env Vars: 비어 있음 (Foundation Phase 2에서 입력)
- 랜딩 콘텐츠: Bus Cignal 서비스명·CCC 운영 주체·2026년 7월 출시 예정·핵심 기능·비영리 운영·개인정보 처리 원칙 명시
- viewport meta 태그 OK (모바일 대응)
- 다음 즉시 작업: 카카오 비즈니스 정보 심사 재신청 (URL + OVERVIEW.md PDF 첨부)
- 추후 작업: Foundation Phase 2 진입 시 정식 Vercel 셋업 (Next.js 빌드 + env vars + production branch = main)

### 2026-05-28 — 외부 셋업 3/5 진행 중: 카카오 앱·키·도메인·비즈 앱 전환 완료, 비즈니스 정보 심사 대기
- App: **Bus Cignal** (App ID: **1470045**, 카테고리: 자동차/교통수단, 회사명: CCC IT 사역부)
- 키 확보 (1Password 또는 vault 저장):
  - **JavaScript 키**: `(1Password 참조)` → `NEXT_PUBLIC_KAKAO_MAP_API_KEY`
  - **REST API 키**: `(1Password 참조 — git 평문 금지)` → `KAKAO_REST_API_KEY`  ⚠️ 과거 커밋에 평문 노출됨 → rotation 권장
- JavaScript SDK 도메인 등록 (Default JS Key):
  - `http://localhost:3000`
  - `https://bus-cignal.vercel.app` (Vercel 도메인 확정 후 재확인)
- 앱 아이콘 업로드 ✓ (GPT/Gemini로 생성)
- **개인 개발자 비즈 앱 전환 완료** ✓ (전화번호 본인인증 + 카카오비즈니스 통합 서비스 약관 동의, 전환 목적: "직접 입력" + 카카오맵 사용 명시)
- **신청 자격 확인 완료** ✓ (2026.05.28)
- ⚠️ **카카오 정책 변경 발견** (2025년 12월 ~ 2026년 3월 사이):
  - 카카오맵 사용 = 비즈 앱 전환 필수 (이전엔 단순 토글)
  - 비즈 앱 전환은 사업자 등록 안 해도 가능 (개인 전화번호 본인인증 OK)
  - 신의 악단(앱 1442060) 같은 옛 앱은 이전 정책 그대로 작동, 신규 앱은 새 정책 적용
- 🚧 **막힌 지점**: 카카오 "비즈니스 정보 심사" 신청에 **실제 운영 중인 웹사이트 URL 필수**. Bus Cignal은 아직 출시 전이라 URL 없음.
- ⏳ 남은 작업 (Vercel 셋업 후 가능):
  - 비즈니스 정보 심사 신청 (URL = Vercel 임시 랜딩 페이지)
  - 카카오맵 권한 신청 (비즈니스 정보 심사 통과 후)
  - 카카오 측 승인 대기 (통상 1~2일)
- 다음 작업: 외부 셋업 4/5 Vercel + 임시 랜딩 페이지 배포 → 카카오 재신청

### 2026-05-28 — 외부 셋업 2/5: Firebase 프로젝트 생성
- Project ID: **`bus-cignal`** (Spark 무료, Number: 745247736840)
- Firestore (default DB): **`asia-northeast3` (Seoul)** ✓ — 프로덕션 모드 (모든 R/W 차단, Security Rules는 마이그에서 작성)
- FCM API V1: 사용 설정됨 ✓
- Web 앱 등록: nickname `bus-cignal-web` (Hosting 미설정)
- Google Analytics: 비활성화 ✓ / Firebase Gemini AI: 비활성화 ✓
- 자격증명 (1Password 또는 vault 저장 필요):
  - **firebaseConfig** (6키, NEXT_PUBLIC_* 클라이언트 expose)
    - apiKey, authDomain (bus-cignal.firebaseapp.com), projectId (bus-cignal),
      storageBucket (bus-cignal.firebasestorage.app), messagingSenderId (745247736840),
      appId (1:745247736840:web:9ba7e7a1787de06642fdbd)
  - **VAPID public key** (Web 푸시용, 공개 — 클라이언트 expose OK)
  - **Admin SDK JSON** ★★★ (~/Downloads/bus-cignal-firebase-adminsdk-*.json)
    - 서비스 계정: firebase-adminsdk-fbsvc@bus-cignal.iam.gserviceaccount.com
    - 최상위 권한 (Security Rules 우회 가능) — 즉시 안전 위치 이동 필수
- 다음 작업: 외부 셋업 3/5 카카오 개발자센터

### 2026-05-27 — 외부 셋업 1/5: Supabase 프로젝트 생성
- Organization: **CCC IT 사역부** (Free plan, 신규 생성) — 기존 ai-agent-hub org 영구 삭제
- Project: **bus-cignal-prod** (Free plan)
- Region: **Northeast Asia (Seoul) ap-northeast-2** ✓
- Project Ref ID: `zovrgrbrzxpzmgpkxmns`
- Project URL: `https://zovrgrbrzxpzmgpkxmns.supabase.co`
- Status: Healthy
- Security:
  - Enable Data API ✓ (기본)
  - Automatically expose new tables ✓ (기본, RLS로 통제)
  - Enable automatic RLS ✗ (마이그에서 명시적 RLS 작성)
- 자격증명 (1Password "Supabase · bus-cignal-prod" 단일 item에 저장):
  - DB password
  - anon (legacy JWT) + service_role (legacy JWT) ★
  - publishable key (sb_publishable_*) + secret key (sb_secret_*) ★
- 운영 인스턴스 — 코드 작업 전까지 손대지 말 것 (로컬 dev DB는 Docker로)
- 다음: 외부 셋업 2/5 Firebase

### 2026-05-27 23:00 — v1.0 Confirmed Final + 도구 분담·세션 시스템
- SPEC v1.0 Confirmed Final 최종본 (vault README + repo docs/SPEC.md)
- OVERVIEW 디테일 보강 (팀·간사 스팩 파악용, 18개 섹션)
- 로컬 Supabase 셋업 가이드 ONBOARDING에 추가 (Docker)
- `docs/AI-PROMPTS/setup-1~5-*.md` 5개 + setup-README 작성
- WORKLOG·SESSION-HANDOFF 다음 세션 인계 정보 명시
- 모든 결정 사항 반영:
  - 마스터 = 비번 only
  - 간사 가입 시 location 등록 → 출발지 미지정 패널티 제거
  - 부분 매칭 = 우선순위 자동  *(→ v1.1 정정: 간사 수동 선택, priority=힌트)*
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
