## 변경 요약

(3~5줄로 무엇을 했는지)

## 왜 필요한가

(이유·맥락. SPEC 섹션 참조 권장)

## 관련 SPEC / 결정

- `docs/SPEC.md` §
- (해당 시) `docs/decisions/` 링크

## 테스트

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test` (단위)
- [ ] (해당 시) `pnpm test:e2e`
- [ ] 로컬 `pnpm dev`에서 동작 확인
- [ ] (해당 시) iOS PWA·푸시 알림 확인

## 스크린샷·기록 (UI 변경 시)

(이미지·gif·짧은 영상)

## 팀원 작업에 영향

- [ ] 이 변경은 다른 팀원 진행 중인 작업에 **영향 없음**
- [ ] 또는 영향 있어서 다음 파일·영역 동기화 필요:
  - (해당 시 명시)
- [ ] **CHANGELOG.md** Unreleased 섹션 업데이트 (영향 있을 경우 필수)

## 체크리스트

- [ ] 시크릿이 커밋에 포함되지 않았는지 (특히 `.env.local`)
- [ ] DB 마이그레이션은 별도 PR (또는 명시)
- [ ] **매칭 엔진·정산·RLS·Firestore Rules** 변경 시 팀장 사전 합의 (`core` 라벨)
- [ ] 관련 문서 업데이트 (필요 시)
- [ ] PR 크기 300줄 이하 (코드 기준)

## Co-Author (AI 작성 시)

- [ ] 본인이 직접 작성/검토 완료
- [ ] AI 작성분 footer:
  ```
  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```
