# CC → Cowork: Supabase 마이그레이션 실행

## When
- CC에서 새 마이그레이션 SQL 작성 완료
- 로컬 dev DB 또는 운영 DB에 적용 필요

## Who
- **로컬 dev DB 적용**: 팀원·팀장 누구나 (`supabase db reset` 등)
- **★ 운영 DB 적용**: 팀장만 (Cowork으로 Supabase Dashboard 접속)
- 팀원이 작성한 마이그는 PR 머지 → 팀장이 운영에 적용

## Variables
- `{{project_id}}`: Supabase 프로젝트 ref (예: `qqtqwyhclscfjlefkiqr`)
- `{{migration_file}}`: 마이그 파일명 (예: `20260527220000_initial.sql`)
- `{{sql_content}}`: 실제 SQL 내용
- `{{table_count}}`: 생성될 테이블 수 (검증용)

## Prompt Template

```
Bus Cignal Supabase 마이그레이션 실행:

1. https://supabase.com/dashboard/project/{{project_id}} 접속
2. 좌측 메뉴 → "SQL Editor" → "New query" 버튼
3. 다음 SQL을 paste (전부 선택해서 한 번에 paste 추천):

```sql
{{sql_content}}
```

4. 우측 상단 "Run" 클릭 (또는 Cmd+Enter)
5. 결과 확인:
   - 성공 → 좌측 "Table editor"에서 {{table_count}}개 테이블 생성 확인
   - 실패 → 에러 메시지 그대로 복사

6. (선택) "Database" → "Policies"에서 RLS 정책 적용 확인

7. CC에 결과 보고:
   - 성공: "Supabase 마이그 완료"
   - 실패: 에러 메시지 그대로 paste
```

## After Completion

CC가 사용자로부터 결과 받으면:
1. WORKLOG.md `최근 완료` 섹션에 추가
2. SESSION-HANDOFF.md `🔄 현재 인계` → `📚 인계 이력`으로 이동
3. 에러 있으면 디버깅 → 새 마이그 작성 → 다시 인계
