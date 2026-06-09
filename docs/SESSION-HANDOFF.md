# Bus Cignal — Session Handoff

> **AI 자동 생성 파일.** 사람이 직접 편집 X.
> 도구 전환·세션 전환 시 AI가 자동 작성.

---

## 🔄 현재 인계 (Active Handoff)

```
From: CC 세션 (2026-06-10 후속 — 간사 운영 피드백 5건 반영 + v1.1.0 확장·prod 배포)
To: CC 다음 세션

✅ 이번 세션 = 간사 요청 5건 전부 구현·로컬검증·prod 배포. v1.1.0 태그를 최신 커밋(ca6cb91)으로 이동 + 릴리즈 노트 갱신.
   릴리즈: https://github.com/Lumiere001/bus-cignal/releases/tag/v1.1.0

머지된 PR (전부 prod 라이브):
  - **#139** CCC 코드 직접 전달 — state(CSRF) 검증 완화(쿠키 있으면 검증/없으면 통과). 재로그인 없이 1회 통과.
  - **#140** 용어 상행→**가는편**·하행→**오는편**(코드 키 up/down 불변) + 방향별 위치(가는편 출발=지도·도착=평창휘닉스파크 고정 / 오는편 출발=텍스트 기본'블루캐니언 옆 주차장'·도착=지도, 학생 지도는 '지역'쪽) + **신청 학생 선택 거절**(체크한 학생만, 미선택 시 전체취소 경고). 마이그 `request_passengers.declined_at`.
  - **#141** 수요측 신청목록 '학생 직접 신청' 배지.
  - **#142** **입금 계좌** — 차량 등록 시 은행·예금주·계좌번호 입력 + 매칭(송금대기) 후 학생 /s·수요 간사 신청상세에 입금계좌 안내. 마이그 `trips.bank_name/account_number/account_holder`.
  - **#143** **같은 지구 간사 전원 알림** — emit()이 operator 대상을 그 지구 전체 승인 간사로 fan-out(`targets.ts` expandOperatorTargets). 스키마 무변경.

운영/배포 메모:
  - **prod DB 마이그 2건 수동 적용**(`supabase db push`, 링크 프로젝트 `zovrgrbrzxpzmgpkxmns`): `20260610000000_request_passenger_decline`, `20260610000001_trips_account`. ⚠️ CI 자동 적용 X → 컬럼 참조 코드 머지(=Vercel 배포) **전에** 선적용 필수.
  - **main 브랜치 보호(ruleset)**: PR 승인 1건 필수 → CC 셀프 승인 불가. 머지는 사용자 승인 후 `--admin` 강제(매 PR). #139~#143 모두 admin 머지.
  - dev-login `/dev/login`(next dev면 자동, env 불필요). seed-dev에 광주 간사 2명(김광주·이광주 — fan-out 검증용) + 모든 trip 계좌.
  - 원격 브랜치 = main만(정리됨). 로컬 main = origin/main + 이 핸드오프 커밋 1개(미푸시).

검증: tsc·eslint·build green · 단위 46 · e2e 59/59 · 로컬 supabase 실동작(양방향 등록·선택거절·배지·계좌·지구 fan-out) + preview 스크린샷.

다음 세션 후보(미착수):
  - (신규) 학생/수요측 **입금 계좌 '복사' 버튼**(현재 표시만) · 거절된(declined) 학생의 수요측 표시(현재 공급 큐에서만 제외).
  - (기존 잔여) iOS 실기기 스모크 · `operators.login_token` 컬럼 제거 마이그 · 약관 org 4항목(/terms·/privacy).
```

### (이전 인계 — CC 2026-06-10 v1.1.0 출시)

```
From: CC 세션 (2026-06-10 — 학생 직접신청 Phase 2·3 빌드 + v1.1.0 출시까지 완료)
To: CC 다음 세션

✅ 이번 세션 = **v1.1.0 출시 완료** (학생 직접 신청 + 사용성 개선)
   릴리즈: https://github.com/Lumiere001/bus-cignal/releases/tag/v1.1.0 (태그 v1.1.0 · main · prod 배포됨)

머지된 PR (전부 prod 라이브):
  - **#132** 학생 직접신청 Phase 1·2·3 — CCC 학생 로그인 · 차량 둘러보기(지도)·직접 신청 · '예약 확인'=/me 브리지(passenger 세션 발급) · 버스 채팅(match_passengers 신원 재사용) · 승인 큐 '학생 직접 신청' 배지.
  - **#136** 간사 세션 12h→30일 + iOS 설치형 PWA CCC 로그인 안정화(top-level `<a>`·sameSite=lax).
  - **#137** 간사 이름 헤더 · 사용 가이드(/guide)+TIP+docs/GUIDE.md · 전국 잔여석(/status) 진입(간사 상단바·학생 허브) · '← 돌아가기' 버튼(iOS PWA용 router.back).
  - **#138** 간사 매직링크 온보딩 제거(CCC-only) · 간사도 학생 화면 접근(provisionStudentFromCcc의 is_staff 차단 제거) · /s 허브 시각성.

운영 상태 (출시 완료):
  - prod 마이그 `students` 적용 ✅ · CCC 학생 등록 회신 완료 ✅ · Vercel env(STUDENT_SESSION_SECRET·CCC_HANDOFF_STUDENT_CLIENT_ID) ✅
  - Firebase 채팅 더미 삭제 ✅ (직접 조회로 잔여 0 확인) · operators.login_token 잔재는 사용자 SQL로 정리(`update operators set login_token=null`).
  - 실제 간사 1명 운영 진입 중 → **전체 wipe 안 함**(개별 정리만).

다음 세션 할 일 (선택·후속):
  1. **iOS 실기기 스모크** — 설치→앱에서 CCC 로그인 1회(top-level 이동 실검증). 구형 iOS 실패 시 수동코드 폴백 설계.
  2. **operators.login_token 컬럼 제거 마이그** (현재 컬럼 보존·미사용 — 코드 참조 0).
  3. 약관 org 4항목(운영주체·연락처·시행일) → /terms·/privacy.
  4. (선택) 채팅 데스크탑 폭(max-w-md=카톡식 의도) · 운영 중 QA 잔여 데이터 개별 정리.

📌 로그인 4경로: 간사 CCC(/login→/operator, 30일) · 학생 CCC(/s/login→/s, 30일) · 예약번호(/r→/me, 30일) · 마스터 비번(/admin, 24h).
   간사 로그인=staff→/operator·학생→/s · 학생 로그인=누구나 /s(간사 포함, students 별도 신원). iOS PWA는 앱 안 1회 로그인.
📌 출시 전 더미 삭제 도구: `scripts/load/wipe-prod.mjs`(Supabase·students 포함, --confirm) + Firebase 콘솔 `channels` 컬렉션 삭제.
```

### (이전 인계 — CC 2026-06-07 밤5)

```
From: CC 세션 (2026-06-07 밤5 — 🏁① 보안테스트 GO·repo 로컬정리 + 출시 전 버그 2건 수정 머지)
결과: 🏁① 보안 테스트 GO(회귀·보안표면 이상無, 단 repo PUBLIC) · repo 로컬 정리 · PR #121(공개인원↔정원·채팅 no-leave)·#122(PWA 설치배너) 머지. 위 밤6에서 출시 완료.
```

### (이전 인계 — CC 2026-06-07 밤4)

```
From: CC 세션 (2026-06-07 밤4 — 피드백 마무리 + prod 활성 완료 + 최종 시퀀스 준비)
결과(#110~#118 머지): #117 '매칭 취소' 용어통일·차량상세404 친절안내 · #118 카카오 프리뷰핀 픽스.
사용자 직접 완료: ✅ prod db push · ✅ firestore.rules 배포(밤4 시점). 🏁① 보안테스트는 밤5에서 수행(GO).
```

### (이전 인계 — CC 2026-06-07 밤)

```
From: CC 세션 (2026-06-07 밤 — 자율 폴리시 5종: 신규기능 테스트·채팅 입퇴장 시스템메시지·채팅 푸시 음소거·hydration 결정화·신규화면 폴리시. #104~#108 머지)
To: CC 다음 세션 (⭐ 여기부터) — 상세는 WORKLOG 최상단 "2026-06-07 밤" 엔트리
결과: #104~#108 전부 CI green·main 머지(열린 PR 0). typecheck·lint·단위255·build·E2E46(기존35 유지) green. 채팅 규칙은 Firebase 에뮬레이터 test:rules 22 pass(@14·Java11).
  - #104 채팅 방별 푸시 음소거(chat_mutes 마이그+토글) · #105 hydration 결정화(표시 무변경) · #106 신규기능 테스트(members+E2E 5종) · #107 신규화면 모바일/접근성 폴리시(기능 무변경) · #108 카톡식 입장/퇴장 시스템 메시지(rules system 분기·위조차단)
다음(=prod 활성화, 사용자/Cowork — 코드는 main): docs/PROD-ACTIVATION.md. ①prod regions 시드 ②채팅 prod(Firebase 분리+firebase login+firestore.rules 배포[이제 system 분기 포함, 팀장 승인]+Vercel env)+**chat_mutes 마이그 prod 적용** ③카카오 지도 배포검증(Cowork) ④약관 org 4항목 ⑤더미 삭제 후 최종 배포
블로킹(외부): CCC consumer·지구코드 + CCC 해지큐(CCC API 대기).
남은 검증 권장: 채팅 UI 비주얼 스모크(음소거 토글 + 입퇴장 라인 렌더)는 dev+Firebase 에뮬레이터로 사람/Cowork 1회 — 실시간 UI는 자동화 한계(규칙은 에뮬레이터 자동검증 완료).
로컬 채팅 재개: firebase-tools@14(=Java11 OK, @15는 Java21 필요) 에뮬레이터 + dev 에뮬모드 env. test:rules도 @14 emulators:exec로. 상세 WORKLOG.
```

### ✅ (2026-06-06 시점 기록) 세션 결과 (#77~#81 머지 — 이후 #83~#102까지 추가 머지됨, 위 코드블록·WORKLOG 참조)
- **PR #79** `feat/admin-ops-monitoring` 마스터 운영 모니터링(/admin/system).
- **PR #80** `fix/operator-cookie-render` requireOperator 렌더 중 쿠키삭제 버그 픽스.
- **PR #81 `feat/operator-screen-cleanup`** = ⭐ 대개편(간사 1-A/1-C·1-B 대시보드·UI견고화·여러 수정·Phase 2 위저드·**현실 더미시드**·지도 선택 시 핀 중심이동).
  - ⚠️ 처음 push 때 **playwright E2E 1건 실패** → 원인=내 변경 2개(입금확인 "취소불가" **모달** 추가 + 매칭현황 **표** 전환)로 `operator-approve-chain.spec`가 깨짐(입금확인 1번만 클릭/예약번호 셀 분리). **테스트를 모달 확정 + 예약번호 `BUS-XXXX` 패턴으로 갱신해 해결** → 로컬 전체 25 E2E green → **CI 재실행 green**.
- **#79·#80·#81 전부 main 머지 완료** (East_Star가 직접 머지, #77·#78도 이전 머지). 열린 PR 0 → **대개편 전체가 main에 반영됨**. 다음 세션은 **main에서 바로 시작**(별도 브랜치 체크아웃 불필요).
- `chore/realistic-dummy` = #81에 동일 시드 포함 → **폐기(삭제)**.
- 완료/결정/다음할일 **전부 WORKLOG 맨 위 "2026-06-06" 엔트리** 에 상세.

### 🔜 다음 세션 할 일 (= prod 활성화 · 상세 `docs/PROD-ACTIVATION.md`)
> Phase 2~5 빌드 + 지도B·동적 그래프·신청 취소/수정·채팅(카톡식+KCCC)·보안 점검은 **2026-06-07에 전부 완료·머지(#83~#102)**. 이제 prod 활성화 단계.
1. **prod regions 시드**: Supabase Studio에 `supabase/seed.sql` 붙여넣기 또는 `supabase db push` — "지구 선택 안됨" 해소.
2. **카카오 지도 배포 검증**: Cowork(프롬프트 = PROD-ACTIVATION ②).
3. **채팅 prod 활성화**: prod 전용 Firebase 분리 + `firebase login` + `firestore.rules` 배포(CLAUDE.md §2.1 팀장 승인 게이트) + Vercel Firebase env.
4. **약관 org 4항목**(운영주체·보호책임자·연락처·시행일) — 값 받으면 페이지 반영.
5. **실험 더미 삭제** 후 최종 배포.
6. (외부) CCC consumer·지구코드 + CCC 해지큐 — API 대기. 채팅 고급(입장 system 메시지·푸시 옵트인) = 향후.

### ⚠️ 인계 주의
- **카카오 지도**: 로컬은 빌린 키라 미표시(코드는 graceful 에러). **배포 후 카카오 콘솔에 도메인(localhost+Vercel) 등록 → 간사 결과지도 + 학생 지도 둘 다 검증.**
- 타지구 신청 모델: **출발=공급지구 선택**(정정 완료). 권역 매핑은 `RequestWizard.tsx` 상수(regions.area→권역).
- ~~머지 권장~~ → **완료**: #79·#80·#81 모두 main 머지됨. 다음 세션은 main 기준으로 새 브랜치 분기(스택 금지: 항상 최신 main에서).
- 학생 전화 풀노출=간사 화면 한정(승인). 마스터=전용 비번(CCC 분리). 승인대기→CCC 자동입장+예외/해지 큐(미구현).
- **알려진 비치명 issue(다음 정리거리)**: client 컴포넌트(`MatchingQueue.tsx` 등)의 `formatKstDateTime`=`toLocaleString`이 Node/브라우저 ICU 차이로 **hydration 경고** 발생(기능 영향 없음, 기존 issue·이번 변경 무관). 정리하려면 `lib/datetime`의 `formatKstShort`(결정적 ISO 슬라이스)로 교체.

### ▶️ 다음 세션 시작 방법
1. `cd /Users/east_star/Projects/bus-cignal && claude` (최신 main 기준 — 스택 금지)
2. 첫 메시지(복사용):
   > Bus Cignal 이어가자 — WORKLOG 최상단 "2026-06-07" 엔트리 + SESSION-HANDOFF(현재 인계) + docs/PROD-ACTIVATION.md 읽고 이어서 진행해줘. 현재 #83~#102 머지(열린 PR 0)·코드 완료·검증 끝(E2E 35 + 채팅 에뮬레이터), 남은 건 prod 활성화. 오늘 할 것: <원하는 것>
3. (로컬 데이터 테스트) `supabase start && supabase db reset && node scripts/load/seed-dummy.mjs --students 1000` → `pnpm dev` → `/dev/login`(간사 클릭).
4. (로컬 채팅 테스트) `npx firebase-tools@14 emulators:start --only firestore,auth --project demo-bus-cignal` + dev를 `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1 NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-bus-cignal FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 pnpm dev`. ⚠️ `pnpm build`는 `.next`를 공유해 실행 중 `pnpm dev`를 죽임(빌드 시 dev 중지).

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
