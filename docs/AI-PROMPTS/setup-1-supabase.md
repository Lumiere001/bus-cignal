# Setup 1/5 — Supabase 프로젝트 생성 (Cowork)

## When
- Foundation 시작 전 외부 도구 셋업 1단계
- 팀장이 한 번만 실행 (운영용)

## Cowork에 paste

```
Bus Cignal Supabase 프로젝트 만들어줘.

1. https://supabase.com 접속 → Google 계정으로 로그인
2. "New project" 클릭
3. Organization:
   - 기존 org 있으면 선택
   - 없으면 "Create new organization" → 이름 "CCC IT 사역부" (또는 본인)
4. 프로젝트 설정:
   - Name: bus-cignal-prod  (운영용)
   - Database Password: 강력한 비번 자동 생성 → ★ 메모해두기
   - Region: ★ Northeast Asia (Seoul) — 변경 불가, 꼭 확인
   - Pricing Plan: Free
5. "Create new project" 클릭 → 2~3분 대기

생성 완료 후 다음 정보 알려줘 (전부 1Password에 저장):
- Project URL: https://xxxxx.supabase.co (Settings → API → URL)
- Project Reference ID: xxxxx (URL의 xxxxx 부분)
- anon public key (Settings → API → Project API keys → anon public)
- service_role secret key ★★ (절대 외부 노출 X)
- Database password

완료 후 CC에 알려줘.
```

## After Completion (CC가 할 일)
1. WORKLOG `🔄 현재 작업` 갱신
2. SESSION-HANDOFF에 setup 1/5 완료 기록
3. setup-2-firebase.md 안내
