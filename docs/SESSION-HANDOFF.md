# Bus Cignal — Session Handoff

> **AI 자동 생성 파일.** 사람이 직접 편집 X.
> 도구 전환·세션 전환 시 AI가 자동 작성.

---

## 🔄 현재 인계 (Active Handoff)

```
From: CC 세션 (2026-05-27 23:00, 세션 포화로 종료)
To: 다음 CC 세션
목적: 외부 도구 셋업 Cowork 프롬프트 5개 순차 제공
```

### 사용자 가이드 (다음 세션 시작)

```bash
cd /Users/east_star/LIFE   # 현재 세션과 동일 위치
claude                     # CC 시작
```

첫 메시지: `"작업 이어가자"` (또는 비슷한 의도)

### 다음 세션 시작 시 CC가 자동으로 할 일

1. **자동 절차 (CLAUDE.md 명시된 강제 절차)**:
   - `git fetch origin main` + log 비교
   - `cat /Users/east_star/projects/bus-cignal/CHANGELOG.md | head -50`
   - `cat /Users/east_star/projects/bus-cignal/WORKLOG.md` ← 현재 단계
   - `cat /Users/east_star/projects/bus-cignal/docs/SESSION-HANDOFF.md` ← 인계 정보
   - `cat /Users/east_star/projects/bus-cignal/.team-role` ← 본인 역할 (예: team-lead)
   - `ls /Users/east_star/LIFE/projects/bus-cignal/team-lead-prompts/` ← 팀장 vault 확인
   - SPEC / CLAUDE diff 분석

2. **사용자에게 첫 인사·확인**:
   ```
   "지난 세션에서 v1.0 Confirmed Final 기획 완료, 외부 도구 셋업 직전에 종료됨.
    이번 세션에서 외부 도구 셋업 5단계 시작할까요?
    
    1. Supabase (Seoul)
    2. Firebase + Firestore + FCM
    3. 카카오맵
    4. Vercel + GitHub 연동
    5. 마스터 비번 + bcrypt
    
    1번부터 Cowork 프롬프트 드릴까요?"
   ```

3. **사용자 OK 시** (단 vault 존재 확인 필수 = 팀장 머신):
   - **vault** `~/LIFE/projects/bus-cignal/team-lead-prompts/setup-1-supabase.md` 읽음
   - 프롬프트 코드 블록을 그대로 사용자에게 제공
   - 사용자가 Cowork에 paste → 진행
   - 키·정보 받으면 → 1Password 저장 확인 + WORKLOG 갱신
   - setup-2로 진행

   ※ vault 없는 머신(팀원) = 팀장 작업 차단, "팀장에게 요청" 안내

4. **5단계 완료 후**:
   - WORKLOG `🔄 현재 작업` = "Foundation Phase 1 진입"
   - 이 파일 인계 완료 표시
   - Foundation 코드 작성 시작

### 어디까지 했나 (지난 세션)

- ✅ 기획 v1.0 Confirmed Final 모든 결정 완료 (28개 안건)
- ✅ vault README + repo docs/SPEC.md 동기화
- ✅ OVERVIEW 디테일 보강 (팀·간사 스팩 파악용, 18개 섹션)
- ✅ 팀원 문서 트리오 (CLAUDE·AGENTS·ONBOARDING·CONTRIBUTING·COWORK) 모두 v1.0 Final 반영
- ✅ WORKLOG·SESSION-HANDOFF·CHANGELOG·PR template 시스템 구축
- ✅ `docs/AI-PROMPTS/` setup-1~5-*.md + cc-to-cowork-*.md + cc-to-chat-*.md 등 11개 템플릿
- ✅ 로컬 Supabase (Docker) 가이드 ONBOARDING에 추가
- ✅ "East_Star" → "팀장" 일괄 교체
- ✅ GitHub repo (private, push 완료)
- ✅ 지구 52개 seed 데이터 (`data/regions.csv`)
- ✅ 통합 검토 후 모순·결정 안 된 것 모두 해결

### 무엇이 남았나

- ⏳ 외부 도구 셋업 5단계 (사용자가 Cowork으로)
- ⏳ Foundation Phase 1 (Next.js 스캐폴드 등, 외부 의존성 없음)
- ⏳ Foundation Phase 2 (Supabase·Firebase·카카오·PWA 통합, 외부 키 받은 후)
- ⏳ Foundation Phase 3 (Playwright E2E·Sentry·배포)
- ⏳ 팀원 초대 (Phase 3 완료 후)
- ⏳ Feature 분담 개발

### 중요 컨텍스트

- **vault**: `~/LIFE/projects/bus-cignal/` (팀장 개인, 안 공유)
- **repo**: `~/projects/bus-cignal/` ↔ GitHub `Lumiere001/bus-cignal` (private)
- **팀원 분담**:
  - 팀장 = Foundation + 매칭 코어 + 정산 + 인프라 + E2E
  - 팀원 1 = 운영자·마스터 UI (Trip·매칭 큐·정산·관리자)
  - 팀원 2 = 학생·채팅 (예약번호·대시보드·카카오맵·Firestore)
- **로컬 Supabase**: 팀원 각자 Docker로 dev DB (ONBOARDING §2.3)
- **시크릿 분배**: 1Password 공유 vault (팀원에겐 dev 키만)
- **마스터 인증**: 비밀번호 only (Google OAuth 제거)
- **간사 가입**: Google OAuth + 본인 지구 + 출발/도착지 N개 등록 + 마스터 승인
- **알림 채널**: 인앱 + PWA 푸시 (FCM). 이메일·SMS·알림톡 X

---

## 📚 인계 이력 (Recent Handoffs)

(완료된 인계 시간 역순)

- 없음 (이번이 첫 도구 전환 인계)

---

## 🛠 자동화 규칙

(`CLAUDE.md`·`AGENTS.md`에 강제 절차 명시되어 있음)

### Trigger (이 파일 자동 작성 의도)
- "Cowork으로 넘기자"
- "디자인 mock 만들자 (Chat에서)"
- "Supabase 가서 직접 확인"
- "끝내자", "다음에 이어서"
- 세션 포화 임박 알림

### 자동 작성 절차
1. 현재 작업 컨텍스트 요약
2. `docs/AI-PROMPTS/` 적절한 템플릿 로드
3. 변수 채워서 복사용 코드 블록 제공
4. 이 파일 `🔄 현재 인계` 섹션 갱신

### 완료 처리
사용자 인계 완료 알림 시:
- `🔄 현재 인계` → `📚 인계 이력`로 이동
- WORKLOG 갱신 (다음 작업)
