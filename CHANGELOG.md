# Changelog

> Bus Cignal의 변경 기록 (사람·AI 둘 다 읽기 쉬운 형식).
> [Keep a Changelog](https://keepachangelog.com/) 컨벤션 따름.
> AI는 작업 시작 시 **[Unreleased]** 섹션 자동 확인하여 본인 작업 영역 영향 평가.

---

## [Unreleased]

### Added
- (개발 시작 후 추가)

### Changed

### Fixed

### Removed

---

## [v1.0-spec] - 2026-05-27

### 기획 확정 (개발 진입 전 마지막 마일스톤)

- **v1.0 Confirmed** 기획안 확정 (`docs/SPEC.md`)
- 팀원 기획안(이유성·김도영) 검토 후 본 안 채택
- 모든 미해결 안건 결정 완료:
  - 우선순위 기반 자동 부분 매칭 (2h 룰·partial_offers 제거)
  - 학생 검증 = 이름 + 전화 끝 4자리
  - 매칭 후 공급 측 취소 불가 + 승인 전 안내문
  - 학생 자의적 취소 + 양쪽 간사 알림
  - 재신청 추천 UI 도입
  - 간사 가입 → 마스터 승인 흐름
  - 사후 정산 = 캠퍼스 자율 (시스템은 ledger 표만)
  - 거절 모니터링 = V1 단순 알림 (V2 임계값)
  - 시스템 알림 = 인앱 + PWA 푸시 (이메일 X)
  - PWA V1 도입 (FCM, iOS QA 강화 필수)
  - E2E 테스트 V1 필수 (iOS PWA 푸시 포함)
  - 백업 무료 plan만
  - Vercel 기본 도메인
  - 베타 없음, 더미 → 실전
  - public 전환 = 완성 후
  - "팀장"·"Lead" 표기 (개인 별명 비공개)
  - carbus-web과 별개

### 팀원 문서 트리오 작성
- `CLAUDE.md` / `AGENTS.md` — AI 컨텍스트 (Codex 미러)
- `ONBOARDING.md` — 팀원 시작 가이드 (에이전틱 코딩 초보 OK)
- `CONTRIBUTING.md` — commit·PR·branch 규칙
- `COWORK.md` — Cowork 활용
- `CHANGELOG.md` — 본 파일

### 지구 마스터 데이터
- 전국 52개 지구 등록 (`data/regions.csv`, `docs/REGIONS.md`)

---

## 작성 규칙

### Unreleased 섹션
- PR 머지될 때마다 팀장이 한 줄 추가
- AI가 작업 시작 시 자동 확인 (사람 부담 0)

### 카테고리
- **Added**: 신규 기능
- **Changed**: 기존 기능 변경
- **Deprecated**: 곧 제거될 기능
- **Removed**: 제거된 기능
- **Fixed**: 버그 수정
- **Security**: 보안 패치

### 항목 형식
```
- 한 줄 요약 (#PR번호)
  - 영향: 변경된 파일·영역
  - 마이그: 필요 시 마이그레이션 안내
```

### 예시
```
### Changed
- 부분 매칭 데드라인 2h → 우선순위 기반 자동 (#42)
  - 영향: `lib/matching/approve.ts`, B 응답 화면 제거
  - 마이그: `20260601000000_remove_partial_offers.sql` 실행 필요
```

### Release
- `[Unreleased]` → `[vX.Y] - 날짜`로 잠금
- 새 `[Unreleased]` 빈 섹션 신설
