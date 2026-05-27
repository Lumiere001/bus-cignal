# Setup 5/5 — 마스터 비밀번호 + bcrypt hash

## When
- Vercel env vars 입력하기 전 (또는 후 Redeploy)
- 팀장이 한 번만 실행

## 이 작업은 CC + 1Password (Cowork 아님)

```
[Step 1: 강력한 비번 생성 (1Password)]
1. 1Password 열기
2. 새 항목 추가:
   - Type: Login (또는 Password)
   - Title: Bus Cignal Master Password
   - Generate password:
     - 길이: 24자
     - 문자: 대소문자 + 숫자 + 특수문자
   - Save
3. 비번 복사 (클립보드)

[Step 2: bcrypt hash 생성 (CC 터미널)]
4. ~/projects/bus-cignal 에서:
   $ pnpm add -D bcrypt   # 처음 한 번만
   $ node -e "console.log(require('bcrypt').hashSync(process.argv[1], 10))" '<비번>'
   
   결과 예시: $2b$10$abc123...xyz789

   ※ 보안: shell history에 비번 남지 않게 process.argv 사용
   ※ 또는 stdin: read -s p && node -e "console.log(require('bcrypt').hashSync('$p', 10))"

[Step 3: Vercel env vars에 등록]
5. Vercel Settings → Environment Variables
6. MASTER_PASSWORD_HASH = <bcrypt hash 결과>
7. Production·Preview·Development 모두 체크 → Save
8. Deployments → 최근 배포 → "Redeploy" (env 변경 반영)

[Step 4: 백업]
9. 1Password "Bus Cignal Master Password" 항목 업데이트:
   - 원본 비번 (이미 있음)
   - bcrypt hash 추가
   - 분실 시 복구 절차 메모

★ 원본 비번을 잊으면 복구 불가 (bcrypt 단방향) → 1Password 의무
★ 분실 시 새 비번 생성 → 새 hash → env 갱신 → 재배포 (5~10분)
```

## After Completion (CC)
1. WORKLOG 갱신: "외부 도구 셋업 5/5 완료"
2. 모든 키가 1Password·Vercel env에 있는지 최종 점검
3. Foundation Phase 2 (외부 의존 작업) 진입
