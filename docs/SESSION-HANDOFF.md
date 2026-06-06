# Bus Cignal — Session Handoff

> **AI 자동 생성 파일.** 사람이 직접 편집 X.
> 도구 전환·세션 전환 시 AI가 자동 작성.

---

## 🔄 현재 인계 (Active Handoff)

```
From: CC 세션 (2026-06-06 — UI/UX 대개편 + Phase 2 + 현실 더미, 멀티에이전트)
To: CC 다음 세션 (⭐ 여기부터)
목적: Phase 2 남은 하위 → Phase 3(마스터) → Phase 4(학생) → Phase 5(공개) 순 진행
```

### ✅ 이번 세션 결과 (#77~#81 전부 main 머지 완료 — 열린 PR 0)
- **PR #79** `feat/admin-ops-monitoring` 마스터 운영 모니터링(/admin/system).
- **PR #80** `fix/operator-cookie-render` requireOperator 렌더 중 쿠키삭제 버그 픽스.
- **PR #81 `feat/operator-screen-cleanup`** = ⭐ 대개편(간사 1-A/1-C·1-B 대시보드·UI견고화·여러 수정·Phase 2 위저드·**현실 더미시드**·지도 선택 시 핀 중심이동).
  - ⚠️ 처음 push 때 **playwright E2E 1건 실패** → 원인=내 변경 2개(입금확인 "취소불가" **모달** 추가 + 매칭현황 **표** 전환)로 `operator-approve-chain.spec`가 깨짐(입금확인 1번만 클릭/예약번호 셀 분리). **테스트를 모달 확정 + 예약번호 `BUS-XXXX` 패턴으로 갱신해 해결** → 로컬 전체 25 E2E green → **CI 재실행 green**.
- **#79·#80·#81 전부 main 머지 완료** (East_Star가 직접 머지, #77·#78도 이전 머지). 열린 PR 0 → **대개편 전체가 main에 반영됨**. 다음 세션은 **main에서 바로 시작**(별도 브랜치 체크아웃 불필요).
- `chore/realistic-dummy` = #81에 동일 시드 포함 → **폐기(삭제)**.
- 완료/결정/다음할일 **전부 WORKLOG 맨 위 "2026-06-06" 엔트리** 에 상세.

### 🔜 다음 세션 할 일 (우선순위)
1. **Phase 2 남은 하위**: 신청 목록 상/하행 분리+옵시디언 그래프뷰·노드 클릭 정보/수정 · **신청 취소** · 신규 "우리 버스 탄 타지구 학생 모아보기 + 간사 채팅".
2. **Phase 3 마스터**: Trip 검색 · 매칭 그래프뷰(노드=지구·간선=매칭·요청량=노드크기·클릭→지구상황) · 정산 매트릭스 UI개선+검색 · CCC 연결 예외/해지 큐.
3. **Phase 4 학생**: 지도(배포 후 카카오 도메인 등록)·문의 연락처 총무 추가·**그룹 채팅(같은 버스+간사)+읽음 수**.
4. **Phase 5 공개**: 전국 지구별 잔여석·신청인원 뷰(무로그인·무PII).
5. **Phase 6**: CCC consumer(외부 API 대기) + 지구코드 매핑.
6. 운영: 약관 「확정 필요」 4개(운영주체·보호책임자·연락처·시행일, 대기) · iPad QA(배포 또는 Tailscale HTTPS).

### ⚠️ 인계 주의
- **카카오 지도**: 로컬은 빌린 키라 미표시(코드는 graceful 에러). **배포 후 카카오 콘솔에 도메인(localhost+Vercel) 등록 → 간사 결과지도 + 학생 지도 둘 다 검증.**
- 타지구 신청 모델: **출발=공급지구 선택**(정정 완료). 권역 매핑은 `RequestWizard.tsx` 상수(regions.area→권역).
- ~~머지 권장~~ → **완료**: #79·#80·#81 모두 main 머지됨. 다음 세션은 main 기준으로 새 브랜치 분기(스택 금지: 항상 최신 main에서).
- 학생 전화 풀노출=간사 화면 한정(승인). 마스터=전용 비번(CCC 분리). 승인대기→CCC 자동입장+예외/해지 큐(미구현).
- **알려진 비치명 issue(다음 정리거리)**: client 컴포넌트(`MatchingQueue.tsx` 등)의 `formatKstDateTime`=`toLocaleString`이 Node/브라우저 ICU 차이로 **hydration 경고** 발생(기능 영향 없음, 기존 issue·이번 변경 무관). 정리하려면 `lib/datetime`의 `formatKstShort`(결정적 ISO 슬라이스)로 교체.

### ▶️ 다음 세션 시작 방법
1. `cd /Users/east_star/Projects/bus-cignal && claude`
2. 첫 메시지: **"Bus Cignal 이어가자 — WORKLOG·SESSION-HANDOFF 읽고 Phase 2 남은 하위부터"**
3. 재개: `supabase start && supabase db reset && node scripts/load/seed-dummy.mjs --students 1000` → dev 서버(`/run`/preview) → `/dev/login`(간사 클릭). ⚠️ reseed 시 기존 세션 stale → 다시 클릭.

### 블로커
- CCC consumer = 외부 API 대기. 그 외엔 매직링크로 운영 가능. 카카오 지도는 배포 후 검증.

---

(아래는 직전 Cowork→CC 인계 — 처리 완료)

```
From: Cowork 세션 (2026-06-05 새벽, vault 프롬프트 실행 후 — Vercel env 확인 + 라이브 스모크)
To: CC 다음 세션 (팀장 머신)
목적: 운영 DB 마이그 적용 (#61~67) + Cowork 발견 PWA 이슈 픽스
```

### ✅ CC 처리 결과 (2026-06-05 — 위 핸드오프에 대한 응답·정정)

- **#1 운영 DB = 이미 완료(정정).** CC 검증: `supabase migration list` Local==Remote(5/5) · `db push --dry-run`="Remote database is up to date". prod **테이블 13 · RLS 13 enable · 타입 정식 생성본(#38)**. → Cowork "prod 비어있음/db push 필요/타입 수기미러"는 **stale**(일시정지 직후·오확인 추정). **추가 db push·types regen 불필요(no-op).** (Vercel Firebase env 3개만 GUI 확인 남음 — 다음 Cowork)
- **P1(Service Worker) = 별도 PR 불필요(정정).** FCM SW(`/firebase-messaging-sw.js`)는 **옵트인 시 `lib/push/client.ts`가 등록** → opt-in 사용자 정상(“FCM 수신 불가”는 부정확). `/sw.js`(offline·next-pwa)는 별개·선택. **푸시 실수신 갭 = Phase C 배너 `/me` 마운트(팀원2) + Vercel Firebase env.**
- **이번 CC 세션 머지**: #45·#46(force-dynamic 픽스)·#47·#48(지오코딩)·#50(포맷터DRY+TZ버그)·#51(연락처카드). 이슈 #49·#50·#51 closed. 열린 PR 0.
- **남은 본작업**: CCC 인증(⛔ 외부) · RLS policies 실적용 · Phase C 배너 마운트(팀원2) · P2 아이콘 · P3 admin 모바일 nav(팀원1) · offline PWA(선택).

### 상황 요약 (2026-06-05 기준)

- **✅ Vercel env**: `OPERATOR_SESSION_SECRET` 이미 존재 (Production·Sensitive·5/31 추가) → 추가 없이 유지. main `04e8eac` Production Redeploy 트리거·성공.
- **✅ 라이브 스모크 PASS** (https://bus-cignal.vercel.app, 뷰포트 ~606px·sm 미만, Chrome 윈도우 min-width 한계로 실 375px 못 줄임):
  - 공개 7개(`/`·`/signup`·`/login`·`/privacy`·`/terms`·`/offline`·`/r/BUS-TEST`) + 마스터 로그인 후 `/admin` 8개(대시보드·간사·승인대기·Trip·매칭·정산·거절·시스템) **전부 정상 렌더**.
  - prod DB 비어있음 → 모든 빈 상태 카피·정책 안내문 graceful.
  - **`/admin/settlement` = 실제 N×N 매트릭스 컴포넌트 렌더 확인** (v1.1 SPEC §S5 부합, "공급 지구(행)→신청 지구(열)·칸=공급이 받을 금액·셀 클릭 시 상세" + 정책 푸터 포함, 데이터 없어 "정산 대상 매칭이 아직 없습니다" 카드).
- **🐛 발견 이슈 3건 (출시 차단 아님)**:
  - **P1 [PWA]** Service Worker **미등록** (`navigator.serviceWorker.controller=null`, `getRegistrations().length=0`) → 오프라인 캐싱 X·**FCM 푸시 수신 불가**. **출시 전 필수**. 추정: app/layout `register('/sw.js')` 누락 또는 next-pwa·next 16 App Router 호환 이슈.
  - **P2 [PWA]** manifest 아이콘 1개만 → 192·512 권장 (Lighthouse·iOS 홈화면 품질).
  - **P3 [UI]** `/admin` 헤더 nav scrollWidth=430px → 실 375px 폰에서 가로 스크롤. sm 미만 햄버거/아이콘only/2줄 wrap 검토 (팀원1 영역).

### CC 다음 작업 (우선순위)

1. **#61~67 운영 DB 셋업** (팀장 머신 전용, core):
   - `supabase db push`로 전체 마이그 5개 일괄 적용 (현재 prod public 스키마 빈 상태 — `select tablename from pg_tables where schemaname='public'` = 0행 확인 완료)
   - `pnpm gen:types` → `database.types.ts` 갱신·커밋 (현재 수기 미러 상태)
   - Vercel Production env 3개 확인 (`FIREBASE_ADMIN_PRIVATE_KEY`·`FIREBASE_ADMIN_CLIENT_EMAIL`·`NEXT_PUBLIC_FIREBASE_VAPID_KEY`) → 필요 시 추가 → Redeploy
   - 결과 보고: 테이블 개수·RLS 활성·env 적용 여부
2. **P1 Service Worker 등록** (PWA·푸시 출시 차단, 별도 PR 후보):
   - app/layout 또는 클라이언트 컴포넌트에서 `register('/sw.js')` 호출
   - next-pwa 설정 검증 (next 16 App Router 호환)
   - 라이브 검증: `navigator.serviceWorker.getRegistrations()` non-empty
3. **#43** vercel.json cron 2개 인식 + Hobby/Pro 체크 (Cowork 다음 세션도 가능 — Vercel Cron 탭 GUI)
4. **P2** PWA 아이콘 (192·512) 추가 — 디자인 협업
5. **P3** `/admin` mobile nav 픽스 — 팀원1 영역으로 핸드오프

### 자원 상태

- prod Supabase `bus-cignal-prod` (Seoul): paused 아님, **public 스키마 빈 상태** (마이그 미적용)
- Vercel: main `04e8eac` Production 정상, env 18개 + OPERATOR_SESSION_SECRET 모두 in place
- 마스터 로그인: 라이브 작동 확인 (`$2b$12$BMUox5...`, bcrypt 검증 PASS)
- Kakao 키: 팀원2 앱 키 사용 중 (`NEXT_PUBLIC_KAKAO_MAP_API_KEY=8f6c5e02...`, `KAKAO_REST_API_KEY=ea44fc7a...`)
- main 게이트: green (열린 PR 0)

### 블로커

- 없음 (외부 블로커 CCC IT 답은 별개·여전히 대기)

### 시크릿 (참고)

> ⚠️ **모든 키 값은 1Password에만.** git·채팅·문서에 평문 금지.

- 운영 시크릿(service_role·Firebase Admin·MASTER_PASSWORD·세션 시크릿): 팀장 1Password 운영 vault
- 팀원 dev 키(dev Firebase 웹 config): 공유 vault

---

## 📚 인계 이력 (Recent Handoffs)

(완료된 인계 시간 역순)

- **2026-05-30** — CC → 팀원 온보딩 인계 (v1.1 + Phase 3 인프라 + Foundation Phase 2 완료, 팀원 2명 합류 대기).
- **2026-05-28** — Foundation Phase 2 P2-1~P2-4 (마스터 비번) 완료. 임시 랜딩(카카오 심사용) 완료.
- 2026-05-27 — 첫 도구 전환 인계 (외부 셋업)

---

## 🛠 자동화 규칙

(`CLAUDE.md`·`AGENTS.md`에 강제 절차 명시되어 있음)

### Trigger (이 파일 자동 작성 의도)
- "Cowork으로 넘기자" / "디자인 mock 만들자 (Chat)" / "Supabase 가서 직접 확인"
- "끝내자", "다음에 이어서" / 세션 포화 임박 알림

### 자동 작성 절차
1. 현재 작업 컨텍스트 요약 (시크릿 평문 금지 — 1Password 참조만)
2. `docs/AI-PROMPTS/` 적절한 템플릿 로드
3. 변수 채워서 복사용 코드 블록 제공
4. 이 파일 `🔄 현재 인계` 섹션 갱신

### 시크릿 노출 대응 (rotation)
- 카카오 REST API Key가 과거 커밋에 평문 노출됨 (private repo). 팀원 합류 전 **rotation 권장**:
  1. 카카오 개발자센터 → 앱 → 보안 → REST API Key 재발급 (Cowork/팀장)
  2. 1Password + Vercel env(`KAKAO_REST_API_KEY`) 갱신 → 재배포
  3. (선택) git history 정리는 private+rotation으로 갈음 (filter-repo는 과함)

### 완료 처리
사용자 인계 완료 알림 시: `🔄 현재 인계` → `📚 인계 이력` 이동 + WORKLOG 갱신
