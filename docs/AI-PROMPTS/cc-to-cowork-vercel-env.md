# CC → Cowork: Vercel 환경 변수 설정

## When
- 새 환경 변수 추가/변경 필요
- 운영 배포 전 env vars 점검

## Variables
- `{{vercel_project}}`: Vercel 프로젝트명 (예: `bus-cignal`)
- `{{env_vars}}`: 추가/변경할 환경 변수 목록

## Prompt Template

```
Bus Cignal Vercel 환경 변수 설정:

1. https://vercel.com/dashboard 접속
2. 프로젝트 "{{vercel_project}}" 선택
3. Settings → Environment Variables

4. 다음 변수 추가/수정 (Production·Preview·Development 적절히):

{{env_vars}}

예시:
- Key: NEXT_PUBLIC_SUPABASE_URL
  Value: https://xxxxx.supabase.co
  Environment: Production, Preview, Development

5. "Save" 클릭

6. (변경 사항 반영) Deployments → 가장 최근 배포 → "Redeploy"
   - "Use existing Build Cache" 체크 해제 권장

7. CC에 결과 보고:
   - 성공: "env vars 설정·재배포 완료"
   - 실패/이상: 스크린샷 또는 에러 메시지

※ 보안: Vercel 화면에서 변수값 복사·붙여넣기 시 화면 노출 주의
```

## After Completion

1. CC: 배포 URL 동작 확인
2. WORKLOG·SESSION-HANDOFF 갱신
