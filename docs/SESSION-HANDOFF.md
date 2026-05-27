# Bus Cignal — Session Handoff

> **AI 자동 생성 파일.** 사람이 직접 편집 X.
> 도구 전환 시점(CC ↔ Cowork ↔ Chat)에 AI가 자동 작성.
> 사용자가 다음 도구에서 복사·실행하기 위한 인계 정보.

---

## 📋 사용 방법

1. CC에서 작업하다가 다른 도구가 필요한 시점 (예: Supabase 마이그 실행)
2. 사용자가 "Cowork으로 넘기자" 또는 비슷한 의도 표현
3. **AI가 이 파일 자동 작성** + 사용자에게 복사용 프롬프트 제공
4. 사용자가 다른 도구에서 paste & 진행
5. 다른 도구 작업 끝나면 CC로 돌아와서 "Cowork에서 완료, 이어가자"
6. AI가 이 파일 자동 읽고 작업 재개

---

## 🔄 현재 인계 (Active Handoff)

> **상태**: idle (현재 인계 없음)

(AI가 도구 전환 시점에 아래 형식으로 자동 작성)

---

### 예시 형식 (AI가 자동 채움)

```
## 🔄 현재 인계 — 2026-05-27 22:30

**From**: Claude Code
**To**: Cowork
**목적**: Supabase 마이그레이션 실행

### 어디까지 했나
- `supabase/migrations/20260527220000_initial.sql` 작성 완료 (12개 테이블 + RLS)
- 로컬 테스트 통과 (`pnpm test`)
- PR #1 생성 대기

### 지금 필요한 것
운영 Supabase에 마이그 실행 필요

### Cowork에서 할 일 (복사용 프롬프트)

\`\`\`
Bus Cignal Supabase 마이그레이션 실행:

1. https://supabase.com/dashboard/project/<프로젝트ID> 접속
2. 좌측 메뉴 → SQL Editor → New query
3. 다음 SQL paste:

[--- 시작 ---]
<SQL 내용 자동 첨부>
[--- 끝 ---]

4. Run 버튼 클릭
5. Tables 탭에서 12개 테이블 생성 확인
6. RLS Policies 탭에서 정책 적용 확인
7. 결과 (성공/에러 메시지) CC에 알려주기:
   - 성공이면 "마이그 완료" 이미지·텍스트
   - 에러면 에러 메시지 그대로 복사
\`\`\`

### Cowork 완료 후 CC에 다시 와서 할 일
- "Cowork에서 마이그 실행 완료" 알리기
- 에러 있었으면 그대로 paste → AI가 수정 → 새 마이그 생성
```

---

## 📚 인계 이력 (Recent Handoffs)

(AI가 완료된 인계를 시간 역순으로 보관)

- 없음

---

## 🛠 자동화 규칙

### Trigger (AI가 자동으로 이 파일 작성하는 의도들)
- "Cowork으로 넘기자"
- "디자인 mock 만들어줘 (Chat에서)"
- "Supabase 가서 직접 확인"
- "Vercel 배포 확인 좀"
- "GitHub UI에서 PR 보자"
- 작업 중 외부 도구 필요 의도

### 자동 작성 절차
1. 현재 작업 컨텍스트 요약 (어디까지·다음·왜)
2. 해당 도구별 템플릿 (`docs/AI-PROMPTS/<도구>-<목적>.md`) 로드
3. 변수 채우기 (project_id·SQL 내용·URL 등)
4. 사용자에게 복사용 코드 블록 제공
5. 이 파일 `🔄 현재 인계` 섹션 갱신

### 완료 처리
- 사용자가 인계 완료 알리면
- `🔄 현재 인계` → `📚 인계 이력`로 이동 (시간 역순)
- WORKLOG.md 갱신 (다음 작업 단계)
