# Setup 4/5 — Vercel 프로젝트 생성 + GitHub 연동 (Cowork)

## When
- Supabase·Firebase·카카오 키 모두 확보 후
- 마스터 비번 hash 생성 후 (setup-5)

## Cowork에 paste

```
Bus Cignal Vercel 프로젝트 만들어줘.

1. https://vercel.com 접속, GitHub 계정으로 로그인
2. "Add New..." → "Project"
3. "Import Git Repository":
   - GitHub 연동 (처음이면 권한 부여)
   - "Lumiere001/bus-cignal" 검색 → "Import"
4. Configure Project:
   - Project Name: bus-cignal
   - Framework Preset: Next.js (자동 감지)
   - Root Directory: ./
   - Build Command: pnpm build (기본)
   - Install Command: pnpm install
   - Output Directory: .next (기본)

[Environment Variables — 매우 중요]
5. "Environment Variables" 섹션 펼치기
6. 다음 변수 모두 입력 (Production·Preview·Development 다 체크):

   NEXT_PUBLIC_SUPABASE_URL=<Supabase에서 받은 값>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<...>
   SUPABASE_SERVICE_ROLE_KEY=<...>
   NEXT_PUBLIC_FIREBASE_API_KEY=<...>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<...>
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<...>
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<...>
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<...>
   NEXT_PUBLIC_FIREBASE_APP_ID=<...>
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=<...>
   FIREBASE_ADMIN_PRIVATE_KEY=<JSON의 private_key, \n 보존>
   FIREBASE_ADMIN_CLIENT_EMAIL=<JSON의 client_email>
   NEXT_PUBLIC_KAKAO_MAP_API_KEY=<...>
   KAKAO_REST_API_KEY=<...>
   MASTER_PASSWORD_HASH=<bcrypt hash, setup-5에서 생성>
   NEXT_PUBLIC_APP_URL=<Vercel 도메인>

7. "Deploy" 클릭 → 빈 프로젝트라 빌드 실패해도 OK (코드 없음)

[Settings 확인]
8. Settings → General → Production Branch: main
9. Settings → Domains → 기본 도메인 확인 (예: bus-cignal.vercel.app)

알려줘:
- Vercel 프로젝트 URL (대시보드)
- 기본 도메인 (이것이 우리 서비스 URL)

완료 후 CC에 알려줘. 도메인 확정되면 카카오 개발자센터에 추가 등록 필요.
```

## After Completion (CC)
1. setup-5-master-password.md 진행 (또는 setup-4 전에 이미 했으면 skip)
2. Foundation Phase 2 진입 (외부 의존 작업)
