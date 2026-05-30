# Bus Cignal — Cowork 활용 가이드

> Cowork = Anthropic의 데스크탑 AI 도구 (https://cowork.anthropic.com).
> Bus Cignal 개발에서 **브라우저·GUI·콘솔 조작이 필요한 작업**에 활용.

---

## 1. Cowork이 뭔가요?

Cowork은 AI가 본인 컴퓨터의 **화면·앱을 보면서 작업을 도와주는 도구**입니다.
- Claude Code(CC)가 터미널·코드 위주라면, Cowork은 브라우저·앱 GUI 위주
- 둘은 보완 관계 — 한쪽이 잘 하는 걸 다른 쪽이 못 함

---

## 2. CC vs Cowork — 언제 무엇을 쓰나?

### CC (Claude Code) 적합
- 코드 작성·수정
- 터미널 명령 (git, pnpm, gh 등)
- 파일 시스템 작업
- 마이그레이션 SQL 작성
- 테스트 작성
- 리팩토링
- 문서 작성

### Cowork 적합
- **Supabase 대시보드** (테이블 확인·SQL 실행·RLS 정책 검토)
- **Vercel 콘솔** (배포 상태·env vars·도메인)
- **Firebase 콘솔** (Firestore 데이터·Security Rules 검토)
- **카카오 개발자센터** (지도 SDK 키·도메인 등록)
- **GitHub UI** (PR 리뷰 시 코드 한 줄씩 보면서)
- **브라우저 실시간 테스트** (UI가 의도대로 동작하는지)
- **모바일 시뮬레이터** (Chrome DevTools 모바일 뷰)
- **간단한 모바일 실기기 확인** (사진 찍어서 화면 확인)
- Cross-app workflow (예: Slack + GitHub + Vercel 동시에)

### 절대 X (CC만)
- 코드 작성 자체는 CC가 컨텍스트 풍부해서 더 잘함
- 큰 파일 편집은 CC

### 혼합
- CC에서 코드 짜고 → Cowork에서 Supabase 대시보드 열어서 마이그 실행
- CC에서 PR 만들고 → Cowork에서 GitHub UI로 리뷰

---

## 3. 자주 쓰는 Bus Cignal 시나리오

### 시나리오 1: Supabase 마이그레이션 적용

**상황**: CC에서 새 마이그레이션 작성 완료. 운영 DB에 적용 필요.

**흐름**:
1. CC에서 마이그레이션 파일 작성 (`supabase/migrations/20260601000000_*.sql`)
2. PR 머지
3. **Cowork에서**:
   - Supabase Dashboard 접속
   - SQL Editor 열기
   - 마이그 파일 내용 paste
   - Run
   - Tables 탭에서 변경 사항 확인
   - RLS 정책 확인

**왜 Cowork**: Supabase CLI로도 가능하지만, 실제로 GUI에서 확인하면서 적용이 안전.

### 시나리오 2: Vercel 배포 확인

**상황**: PR 머지 후 자동 배포 → 실제 사이트 확인 필요.

**흐름**:
1. PR 머지 (CC에서)
2. **Cowork에서**:
   - Vercel Dashboard
   - 배포 상태 확인 (Building → Ready)
   - Preview URL 클릭해서 새 페이지 확인
   - Logs에서 에러 없는지

### 시나리오 3: Firestore 채팅 디버깅

**상황**: 채팅 메시지가 일부 사용자에게 안 보임.

**흐름**:
1. **Cowork에서**:
   - Firebase Console
   - Firestore Database 열기
   - `channels/{tripId}/messages` collection 확인
   - 문제 메시지 document 클릭
   - Security Rules 시뮬레이터로 권한 테스트
2. CC에서 Security Rules 수정 → PR
3. **Cowork에서**: Rules 재배포

### 시나리오 4: 카카오맵 지도 표시 확인

**상황**: 새 Trip 등록 화면에서 지도 미리보기 동작 확인.

**흐름**:
1. CC에서 코드 작성 (`pnpm dev` 실행 중)
2. **Cowork에서**:
   - localhost:3000 열기
   - Trip 등록 페이지 진입
   - 주소 입력해서 지도 뜨는지
   - 모바일 뷰 (DevTools)에서도 확인
   - 안 뜨면 콘솔 로그 확인 (API 키·도메인 등록)

### 시나리오 5: 모바일 실기기 확인

**상황**: 작성한 화면이 실제 iPhone에서 어떻게 보이는지.

**흐름**:
1. localhost를 ngrok 등으로 외부 노출 (또는 Vercel Preview)
2. iPhone에서 접속
3. **Cowork에서**:
   - iPhone 화면 사진 찍어서 Cowork에 업로드
   - "여기 버튼이 너무 작아 보임 — 어떻게 고치지?" 자연어 요청
   - CC로 코드 수정 지시 받음
4. CC에서 수정 → 재배포

---

## 4. Cowork 사용 시 주의사항

### 보안
- **시크릿 화면 캡처 주의** — Supabase service_role key, Firebase 키 등이 화면에 보이면 Cowork이 학습 데이터로 쓰진 않지만, 스크린샷이 어디 남을 수 있음
- 시크릿 화면에서는 Cowork 잠시 중지하거나 다른 탭으로

### 권한
- Cowork이 화면을 보려면 **macOS 접근 권한** 필요
- 첫 사용 시 시스템 환경설정에서 허용

### 한계
- 페이지 로드 늦으면 클릭 잘못 누를 수 있음 (시간 두기)
- 복잡한 클릭 시퀀스는 사람이 직접 하는 게 빠를 때 있음

---

## 5. Cowork 효율 팁

### 작업 시작 전
- 필요한 탭·앱 미리 열어두기
- 인증 미리 (Supabase·Vercel·Firebase·카카오·GitHub 로그인)

### 한 작업당 하나의 도구
- "Supabase 마이그 + Vercel 배포 + 카톡 메시지 보내기" 한 번에 X
- 각각 분리해서 진행

### 실패 시
- 스크린샷 찍어서 팀장에 공유
- Cowork에서 다시 시도하기보다, CC에서 다른 방법 찾기

---

## 6. Bus Cignal 특정 도구 접근 가이드

### Supabase
- URL: https://supabase.com/dashboard/project/<TBD>
- 인증: 팀장가 collaborator 추가
- 주요 화면: Tables · SQL Editor · Auth · Logs · API · Database Migration

### Firebase
- URL: https://console.firebase.google.com/project/<TBD>
- 인증: 팀장가 IAM에서 추가
- 주요 화면: Firestore Database · Authentication · Security Rules · Usage

### Vercel
- URL: https://vercel.com/<team>/<project>
- 인증: 팀장가 멤버 초대
- 주요 화면: Deployments · Settings (Env vars) · Logs · Analytics

### 카카오 개발자센터
- URL: https://developers.kakao.com
- 인증: **팀원2 계정** (팀장 비즈 주체 충돌로 팀원이 본인 앱 등록·키 제공)
- 주요 화면: 내 애플리케이션 → Bus Cignal → 도메인 등록

### GitHub
- URL: https://github.com/Lumiere001/bus-cignal
- 주요 화면: Pull requests · Actions (CI) · Issues · Settings

---

## 7. CC와 Cowork 동시 사용 예시

**일반적인 작업 흐름** (PR 머지부터 배포 확인까지):

```
1. (Cowork) GitHub UI에서 PR 리뷰
   ↓
2. (CC) 코드 수정 요청 → 수정 → push
   ↓
3. (Cowork) GitHub UI에서 PR 재확인
   ↓
4. (Cowork) Merge 클릭
   ↓
5. (Cowork) Vercel Dashboard에서 배포 진행 확인
   ↓
6. (Cowork) Preview URL 열어서 동작 확인
   ↓
7. (필요 시 Cowork) Supabase에서 마이그 실행
   ↓
8. (Cowork) 운영 URL에서 최종 확인
```

---

## 8. 더 알아보기

- Cowork 공식 문서: https://docs.anthropic.com/cowork
- 본 프로젝트 관련 질문: 팀장

---

> Cowork이 만능은 아닙니다. CC가 더 잘 하는 영역에서는 CC를 쓰세요. **각 도구가 잘 하는 것에 집중**.
