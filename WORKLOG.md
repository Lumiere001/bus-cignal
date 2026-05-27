# Bus Cignal — Work Log

> **AI 자동 갱신 파일.** 사람이 직접 편집할 필요 없음 (해도 OK).
> AI가 작업 시작 시 자동으로 읽고, 끝낼 때 자동 갱신.
> 같은 컴퓨터에서 여러 도구(CC·Cowork·Chat) 이동 중 사용 → 세션 손실 방지 핵심.

---

## 🔄 현재 작업 (Active)

- **시작**: 2026-05-27 22:00
- **도구**: Claude Code
- **작업**: 기획 v1.0 Confirmed Final 마무리 + 팀원 문서 트리오 정리
- **위치**: `~/projects/bus-cignal/`
- **다음 단계**:
  - [ ] (대기) 사용자 컨펌 → 본격 개발 진입
  - [ ] Foundation 코드 스캐폴드 (Next.js + Supabase + Firebase + 카카오맵 + PWA)
  - [ ] DB 마이그레이션 1차 작성
  - [ ] CI 설정 (GitHub Actions)
  - [ ] Playwright E2E 스캐폴드

---

## ⏳ 미해결 이슈

- 없음 (모든 안건 결정 완료)

---

## 📌 사용자가 직접 해야 할 일 (Cowork으로 가능)

1. **Supabase 프로젝트 생성** (Seoul 리전) — URL·anon key·service_role
2. **Firebase 프로젝트 생성** (asia-northeast3) — Firestore + FCM 활성화
3. **카카오 개발자센터** 앱 등록 — JavaScript 키 + REST 키
4. **Vercel 프로젝트 생성** + GitHub 연동 + env vars 설정
5. **1Password 공유 vault** — 시크릿 모음 + 마스터 비번 생성
6. **GitHub branch 보호** (main, PR + 팀장 승인 + CI 필수)
7. **팀원 GitHub collaborator** 추가
8. **마스터 비번** bcrypt hash → `.env.local`·Vercel env vars

---

## ✅ 최근 완료 (Recent)

### 2026-05-27 22:00 — v1.0 Confirmed Final
- 모든 미해결 안건 결정 (28개)
- 마스터 인증 = 비번 only (OAuth 제거)
- 간사 가입 시 출발/도착지 등록 → S8 패널티 전면 제거
- 부분 매칭 = 우선순위 기반 자동
- PWA V1 도입 + 학생 진입 옵션 C
- 티켓 번호 `BUS-XXXX` 30자 셋
- 익명화 = 매일 새벽 3시 KST
- 도구 분담 + 세션 손실 방지 시스템 (이 파일 포함)

### 2026-05-27 17:00 — v1.0 Confirmed
- 17개 안건 결정 (1차)
- 우선순위 기반 매칭 도입 (partial_offers 제거)
- "East_Star" → "팀장" 일괄 교체

### 2026-05-26 — 기획 초안 ~ v0.3
- v0.1 초안 → v0.2 부분 매칭 학생 선택 → v0.3 슬라이스 실시간 갱신
- 팀원 기획안(이유성·김도영) 검토 후 본 안 채택
- GitHub repo (Lumiere001/bus-cignal private) 생성
- 팀원 문서 트리오 (CLAUDE·AGENTS·ONBOARDING·CONTRIBUTING·COWORK) 작성

---

## 🛠 AI 자동 갱신 규칙

### 작업 시작 시
AI는 사용자의 "작업 시작" 의도 감지 후 자동 수행:
1. `git fetch origin main`
2. `git log HEAD..origin/main --oneline` — 새 commit 확인
3. `cat CHANGELOG.md | head -50` — Unreleased 섹션
4. `cat WORKLOG.md` ← **이 파일 자동 읽기**
5. SPEC.md / CLAUDE.md diff 분석
6. 본인 작업 영역 영향 평가 → 사용자에 한 줄 보고

### 작업 종료 시
AI는 사용자가 작업 중단 의도 표하면 ("끝내자", "다음에 이어서", "Cowork으로 넘기자") 자동 수행:
1. 현재 작업 상태 → `## 🔄 현재 작업` 섹션 업데이트
2. 미해결 issue → `## ⏳ 미해결 이슈` 추가
3. 완료된 것 → `## ✅ 최근 완료`로 이동
4. 도구 전환이면 → `docs/SESSION-HANDOFF.md` 자동 생성

### 형식 규칙
- `## 🔄 현재 작업` 섹션 = 항상 최상위에 1개
- 완료되면 `## ✅ 최근 완료`로 이동 (시간 역순)
- `## ⏳ 미해결 이슈` = 0개여도 섹션 유지 (가시성)
