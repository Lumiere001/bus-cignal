# Bus Cignal — Work Log

> **AI 자동 갱신 파일.** 사람이 직접 편집 X.
> AI가 작업 시작 시 자동으로 읽고, 끝낼 때 자동 갱신.
> 같은 컴퓨터에서 여러 도구(CC·Cowork·Chat) 이동 중 사용 → 세션 손실 방지 핵심.

---

## 🔄 현재 작업 (Active)

- 📍 **CC 세션 (2026-06-06 — ⭐⭐⭐ 다음 세션 여기부터 읽으세요)**: **UI/UX 대개편 + Phase 2(타지구 신청 위저드) + 현실 더미. 멀티에이전트(Workflow)로 병렬 구현. 전부 게이트 green, push+PR 완료(사용자 예외 허용).**
  - 📦 **푸시·PR 상태 (전부 origin push됨)**:
    - **PR #79** `feat/admin-ops-monitoring` — 마스터 운영 모니터링(/admin/system: DB용량·오늘활동·Pro권장 신호).
    - **PR #80** `fix/operator-cookie-render` — `requireOperator`가 미승인/revoke 간사에 렌더 중 쿠키삭제 → Next16 에러. redirect만 하도록 수정(별도 워크트리).
    - **PR (신규)** `feat/operator-screen-cleanup` — ⭐ **이번 대개편 전체(8커밋)**: 간사화면 1-A/1-C·1-B 대시보드·UI견고화·여러 수정·Phase2 위저드·**현실 더미시드(은행 제거본)**. 머지하면 다 들어감.
    - `chore/realistic-dummy` = feat에 동일 시드 포함되어 **폐기(삭제함)**.
  - ✅ **완료 (feat/operator-screen-cleanup)**:
    - **더미 현실화**: 지구↔평창(상행 6/23 입소·하행 6/27 퇴소), **통합 간사 1명/지구**, 결제 깔때기(awaiting/reported/paid), 평창 지구별 픽업. `scripts/load/seed-dummy.mjs`.
    - **간사 1-A**: 지구명 동적표기 전반("○○ 운영현황/공급차량/신청목록") · 내정보 캠퍼스 제거 · 대기큐 학생+담당간사 **전화 풀노출** · 입금확인 "취소불가" 모달 · 매칭현황 표.
    - **간사 1-C**: 신청·매칭·정산 검색(SearchBox + 클라 필터).
    - **간사 1-B 대시보드 통합**: 공급차량·보낸신청 인라인(클릭=이동)·진입점 통일 · 대기 **팀/명** 분리 · 공급 "입금확인"/수요 "우리 학생 매칭" 분리(숫자 페이지와 일치).
    - **UI 견고화**: admin표·학생카드·간사목록 nowrap/overflow/모바일(정산 매트릭스 가로스크롤+sticky 포함).
    - **Phase 2 타지구 신청 위저드**(기차표식 3단계): ① 조회(**출발=공급지구 선택**·도착 평창·스왑=상/하행·날짜·인원·동의) ② 결과(**선택지구 정확일치 우선 + 권역 추천** `regions.area→권역`, 다중마커 지도, 선택 시 핀 중심이동, 좌석부족=대기신청) ③ 명단 후입력 → `createRequest`(기존 액션). `NewRequestForm` 제거.
    - **송금정보(은행·계좌·예금주) 전면 제거**(더미+matches UI). 송금보고/입금확인 흐름은 유지.
  - 🧩 **공유 컴포넌트 추가**: `lib/auth/operator-region.ts`(getOperatorRegionName) · `components/ui/search-box.tsx` · `components/kakao/KakaoMultiMap.tsx`(다중마커) · `lib/auth/operator-region`.
  - ⚠️ **주의·결정**:
    - **카카오 지도 = localhost 미표시**(빌린 팀원 키). 코드는 graceful 에러. **배포 후 카카오 콘솔에 도메인 등록 → 간사 결과지도 + 학생 지도 둘 다 검증**.
    - 출발=공급지구 선택 모델(처음 본인지구 고정은 오류, 정정됨). 권역 매핑은 `RequestWizard.tsx` 상수.
    - 학생 전화 풀노출=간사 화면 한정(팀장 승인). 마스터=전용 비번(CCC 분리). 승인대기→CCC 자동입장+예외/해지 큐(미구현).
  - 🔜 **다음 할 일 (우선순위)**:
    1. **Phase 2 남은 하위**: 신청 목록 상/하행 분리+옵시디언 그래프뷰·노드 클릭 정보/수정 · **신청 취소** · 신규 "우리 버스 탄 타지구 학생 모아보기 + 간사 채팅".
    2. **Phase 3 마스터**: Trip 검색 · 매칭 그래프뷰(노드=지구·간선=매칭·요청량=노드크기·클릭→지구상황) · 정산 매트릭스 UI개선+검색 · CCC 연결 예외/해지 큐.
    3. **Phase 4 학생**: 지도(배포 후)·문의 연락처에 총무 추가(차량별 총무는 이미 학생 /me/trip 노출 — 지구 공통으로 바꿀지 확인)·**그룹 채팅(같은 버스+간사)+읽음 수**.
    4. **Phase 5 공개**: 전국 지구별 잔여석·신청인원 뷰(무로그인·무PII).
    5. **Phase 6**: CCC consumer(외부 API 대기) + 지구코드 매핑.
    6. 운영: 약관 「확정 필요」 4개(대기) · iPad QA(배포 또는 Tailscale HTTPS).
  - 🧪 **재개 방법**: `supabase start && supabase db reset && node scripts/load/seed-dummy.mjs --students 1000` → dev 서버(`/run` 또는 preview) → `/dev/login`(간사 클릭). 멀티에이전트는 Workflow(파일 분리+인터페이스 계약)로. ⚠️ reseed하면 기존 dev-login 세션 stale → 다시 클릭.

- 📍 **CC 세션 (2026-06-05 심야 — ⭐⭐ 여기부터 읽으세요)**: **전 영역 인수 후 출시 블로커·감사 🟠 거의 소진. PR #56~#69(14건) 머지, prod 마이그 000002~000006 전부 적용, 열린 PR 0.**
  - ✅ **이번 세션 머지 전체 (#56~#69)**: RLS 하드닝(#56)·픽스+감사문서(#57)·취소TZ/chat링크/revoke세션(#58)·**간사 매직링크 로그인+마스터 온보딩**(#59)·약관·방침 PIPA(#60)·worklog(#61)·**operator UX 버그3**(#62: 승인후 큐갱신·거절 전체안내·신청 명단동선)·**🔴 B3 좌석 over-booking·이중매칭 race 원자적 RPC**(#63)·CCC/채팅 결정문(#64,65)·**푸시 배너 v2**(#66, 9개 UX)·**출발 리마인더**(#67, GitHub Actions 외부 스케줄러)·**partial_match 통지+매칭/정산 region 스코핑**(#68)·**학생 본인확인 rate-limit**(#69).
  - ✅ **prod 반영**: 마이그 000002(RLS revoke)·000003(매직링크 컬럼)·000004(원자승인 RPC+unique index)·000005(depart_reminded_at)·000006(verify attempts) **전부 적용**(Local==Remote). anonymize_after=2026-09-29 세팅. Vercel env PASSENGER_SESSION_SECRET 추가(Cowork)·스모크 PASS.
  - ✅ **실사용 흐름 라이브**: 마스터 `/admin/operators` 간사 추가 → 입장링크 카톡 → 간사 `/login/o/<token>` 로그인 → 등록·매칭(race-safe RPC)·정산 / 학생 `/r` 본인확인(rate-limit)·예약·취소 / 약관·방침·RLS·익명화·푸시옵트인 전부 동작.
  - 🎉 **CCC 인증 = B1 해제**(간사 회신): 일회용 코드+검증 API. consumer는 그쪽 API(주말) 도착 후 구현. 매직링크는 백업. **마스터 승인 제거**(자동 입장) 결정. 결정문 `2026-06-05-ccc-operator-auth-confirmed.md`.
  - 🔵 **채팅**: 팀원 설계(Firebase 커스텀 토큰 브리지) 결정문 `2026-06-05-chat-firebase-custom-token-bridge.md` + 구현 점검포인트. 빌드 보류(에뮬레이터 개발). Firestore 룰 prod 열지 말 것.
  - ⚠️ **머지 후 운영 TODO**: ① **저장소 Secrets에 `CRON_SECRET` 등록**(출발 리마인더 GitHub Actions 작동 필수) ② 약관 「확정 필요」 4개(운영주체·보호책임자·연락처·시행일) 사용자 제공 → 페이지 반영.
  - 📊 **남은 출시 블로커**: 사실상 **CCC consumer(외부 API 대기)** 1개 + 약관 org정보. 매직링크로 지금도 운영 가능. 감사 🟡(DB레벨 RLS 옵션B·E2E·dev/prod Firebase 분리)는 출시 후 트랙.
  - 🗂 **감사 종합**: `docs/AUDIT-2026-06-05-production-readiness.md`. 결정문 8건 `docs/decisions/`(인덱스 README).

- 📍 **CC 세션 (2026-06-05 밤)**: **전 영역(팀장+팀원1+팀원2) 인수 후 실사용화 — PR 5건 머지·prod 마이그 적용·간사 로그인 LIVE. + CCC 인증 방식 확정(B1 해제). 열린 PR 0.**
  - ✅ **머지·prod 반영 (#56~#60)**: #56 RLS 하드닝 · #57 픽스(anonymize created_at·마스터잠금)+PWA아이콘+감사문서 · #58 (취소TZ·/chat 깨진링크 숨김·revoke 세션 즉시무효화) · #59 **간사 매직링크 로그인+마스터 온보딩** · #60 약관·방침(PIPA). **prod 마이그 000002·000003 적용 완료**(migration list Local==Remote). **anonymize_after=2026-09-29 세팅**.
  - ✅ **🔑 간사 로그인 LIVE (매직링크, 임시·CCC 전)**: 마스터 `/admin/operators`에서 간사 추가→입장링크 복사→카톡 전달→간사 `/login/o/<token>` 입장(세션 12h). revoke 시 토큰 무효화·재발급 가능. **로컬 Docker curl end-to-end 검증**(유효→/operator 200, 무효→차단). 결정문 `docs/decisions/2026-06-05-operator-magic-link-interim-login.md`.
  - ✅ **Vercel env 보강 (Cowork)**: `PASSENGER_SESSION_SECRET` 없었음→추가(Sensitive·Prod) + Firebase 3개 확인 + Redeploy(`299fe28`) + 스모크 `/r/BUS-TEST` PASS. → 학생 `/r` 제출 런타임오류(B6) 해소. (값 1Password 백업은 사용자 액션·선택)
  - 🎉 **CCC 인증 방식 확정 = B1 블로커 해제** (간사님 회신): **CCC 로그인 → 1회용 코드(TTL 5분) → `?code=XXXX` 리다이렉트 → 우리가 검증 API로 코드 검증해 신원 수신(간사번호·이름·전화·지구코드·지구명)**. 학생은 CCC 불필요(간사 발급=우리 방식). **CCC측 코드검증 API = 주말 도착 예정** → 받으면 **consumer(`?code=` 콜백→API검증→operator upsert→세션) 구현** = 새 큰 작업. 매직링크는 백업으로 유지. 부가요청: **잔여석 공개뷰**(지구별 잔여석·신청인원, 무PII 집계) = 백로그.
  - 🔵 **Firestore(채팅) 팀원2 QA**: 룰 `if false`(차단)라 BLOCKED 문의 → **prod 룰 열지 말 것**(dev/prod 동일 프로젝트=전체공개 위험). 권장=**Firebase 에뮬레이터** 로컬 QA. 채팅 보안룰은 커스텀JWT라 `request.auth` 안 잡힘 → **커스텀 토큰 브리지** 별도 설계 필요(채팅 정식화 시). 채팅 자체는 여전히 보류.
  - 🔜 **다음 빌드 (2번, 결정 끝·사용자 허락 후 착수)**: 🔴 B3 좌석 over-booking race(RPC+unique index) · ⏰ 출발 리마인더(GitHub Actions 외부 스케줄러·출발 전) · 🟠 학생 rate-limit · partial_match 통지 · 매칭/정산 region 스코핑.
  - ⏳ **사용자/외부 대기**: 약관 「확정 필요」 4개(운영주체 법적명칭·보호책임자·연락처·시행일) = 사용자 제공 → 페이지 반영 · CCC 검증 API(주말) · CCC 지구코드표.
  - 📊 **실사용 readiness**: 간사 로그인·법적페이지·RLS·익명화·학생세션 env까지 **GO 근접**. 남은 출시 블로커 = **B3 좌석 race**(돈 직결) + 약관 org정보 확정. CCC 정식연동은 API 대기지만 **매직링크로 지금도 운영 가능**.

- 📍 **CC 세션 (2026-06-05 오후)**: **팀장 영역 — RLS 하드닝(PR #56) + 출시전 픽스 3건(PR #57) + 전체 코드베이스 감사(6도메인) + Docker DB 검증. 열린 PR 2(#56 RLS·#57 픽스, 둘 다 팀장 머지대기).**
  - ✅ **1. RLS = 옵션 A 채택·완료 (PR #56 `feat/rls-hardening-revoke`)**: 접근모델 분석 = 앱 전량 service_role(46곳) 우회 + 커스텀 JWT(`auth.uid()`=null)라 **DB RLS 실효 = anon키 직격 차단뿐 → 이미 deny-default로 성립.** 하드닝 마이그 `20260605000002`(PII 11테이블 anon·authenticated GRANT revoke) + 결정문 `docs/decisions/2026-06-05-rls-deny-default-boundary.md` + 코드점검 통과. **Docker `db reset` 풀 검증 PASS**(anon→match_passengers=false·authenticated→operators=false·anon→regions=true). 옵션 B(DB레벨 지구별)=출시후 / C(Supabase Auth)=비채택. ⚠️ **prod 적용은 #56 머지 후 새 마이그 1개만**(기존 5/5 그대로).
  - ✅ **2. anonymize_after — 종료일 7/1 확정 → 값 2026-09-29(종료+90) prod 세팅 완료**(사용자 1회승인, service_role REST upsert `2026-09-28T15:00Z`, read-back 확인, `updated_by=cc-team-lead`). cron 🔴버그(`created_at<cutoff` 필터 누락→전체 PII 무차별 스크럽)는 **PR #57에서 수정** — 단 #57 배포 전엔 prod cron이 옛 동작이나 9/29 미도래라 `"보관 기간 중"` skip = **무해**(배포 시 적용).
  - ✅ **3. PWA 아이콘 192/512 구현 (PR #57)**: `qlmanage`+`sips`로 SVG→PNG 생성 + manifest 연결. offline PWA(next-pwa)=출시후 권장(2-SW 공존·캐시 리스크).
  - 🔬 **4. 전체 코드베이스 감사 (6도메인 병렬 + 4게이트 + Docker)** → **`docs/AUDIT-2026-06-05-production-readiness.md`** (PR #57). **판정: 조건부 GO — 코어 견고하나 출시 블로커 잔존.** 게이트 전부 PASS(test 165). 🔴블로커: **B1 CCC 간사인증(외부대기, prod 간사 로그인경로 0)** · ~~B2 anonymize created_at~~(✅#57) · **B3 좌석 over-booking race(승인경로 락없음·돈직결)** · **B4 /privacy·/terms 빈 placeholder(PIPA)** · ~~B5 마스터잠금 자기-DoS~~(✅#57) · B6 Vercel PASSENGER_SESSION_SECRET · B7 #56 마이그 적용. 🟠: 학생 rate-limit·이중매칭 index·매칭/정산 region JS필터·revoke후 세션잔존·출발리마인더(Hobby 2cron 포화→Pro결정)·부분매칭통지·/chat 깨진링크·취소 TZ버그.
  - 🔜 **다음(우선순위)**: 팀장 = #56·#57 머지 + #56 마이그 prod 적용 + anonymize_after 세팅방법 결정 + **B3 좌석 race(core)·B4 약관·Pro 승급여부** 판단. 외부 = CCC 인증(B1). 팀원1 = 부분매칭통지·region RLS. 팀원2 = /chat 링크 숨김·취소 TZ버그.

- 📍 **CC 처리 완료 (2026-06-05 오전)**: **Cowork 핸드오프 #1(운영 DB 셋업)은 stale — CC 검증 결과 prod 마이그 이미 다 적용됨(완료). + 이번 CC 세션 PR 6건 머지. 열린 PR 0·열린 이슈 0.**
  - ✅ **#1 운영 DB = 이미 완료 (CC 검증)**: `supabase migration list` Local==Remote(5/5) · `db push --dry-run` = "up to date". **prod 테이블 13개 · RLS 13 enable · 타입 정식 생성본(#38)**. Cowork "0 tables/db push 필요"는 stale(일시정지 직후·오확인 추정) → **추가 push·types regen 불필요(no-op)**. Vercel Firebase env 3개 = GUI 확인만 남음(Cowork).
  - ✅ **이번 CC 세션 머지 6건**: #45 출발/도착지 CRUD · #46 점검모드·마감일(빌드결함 force-dynamic 픽스) · #47 학생 카카오맵 상세 · #48 지오코딩(실제 핀) · #50 포맷터 DRY+**학생 시각 TZ버그 교정** · #51 /me/trip 간사·총무 연락처 카드. 이슈 #49(카카오도메인=팀원 등록·팀장 확인)·#50·#51 closed.
  - 🔍 **P1(Service Worker) 검토 결과**: FCM SW(`/firebase-messaging-sw.js`)는 **옵트인 시 `lib/push/client.ts`가 등록** → opt-in 사용자에겐 정상 동작(Cowork "FCM 수신 불가"는 부정확). `/sw.js`(offline PWA·next-pwa)는 없음=별개·선택. **푸시 실수신 갭 = ① Phase C 배너 `/me` 마운트(팀원2) ② Vercel Firebase Admin·VAPID env** → **P1 별도 PR 불필요**, 배너 마운트가 진짜 액션.
  - 🔜 **다음**: CCC 인증(⛔ 외부 대기) · **RLS policies 실적용**(현재 enable만·deny-default+service_role) · **Phase C 배너 마운트**(팀원2) · P2 PWA 아이콘 192/512 · P3 `/admin` 모바일 nav(팀원1) · offline PWA(next-pwa·선택).

- 📍 **Cowork 후속 (2026-06-05 새벽 — ※위 CC 검증으로 #1·타입·P1 정정됨)**: **vault 프롬프트 따라 Vercel env 확인·라이브 스모크 PASS. 정산 매트릭스 v1.1 실작동 확인. PWA·UI 이슈 3건 발견(차단 아님) → CC에 인계.**
  - ✅ **Vercel env**: `OPERATOR_SESSION_SECRET` 이미 존재 (Production·Sensitive·5/31 추가) → 추가 없이 그대로 둠. main `04e8eac` Production Redeploy 트리거·성공.
  - ✅ **라이브 스모크** (https://bus-cignal.vercel.app, 뷰포트 ~606px·sm 미만, Chrome 윈도우 min-width 한계로 실 375px 못 줄임): 공개 7개(`/`·`/signup`·`/login`·`/privacy`·`/terms`·`/offline`·`/r/BUS-TEST`) + 마스터 로그인 후 `/admin` 8개(대시보드·간사·승인대기·Trip·매칭·정산·거절·시스템) **전부 정상 렌더**. prod DB 비어있음 → 모든 빈 상태 카피·정책 안내문 graceful. **`/admin/settlement` = 실제 N×N 매트릭스 컴포넌트 렌더 확인** (v1.1 SPEC §S5 부합, "공급 지구(행)→신청 지구(열)·칸=공급이 받을 금액·셀 클릭 시 상세" + 정책 푸터 포함, 데이터 없어 "정산 대상 매칭이 아직 없습니다" 카드 표시).
  - 🐛 **발견 이슈 3건 (출시 차단 아님)**:
    - **P1 [PWA]** Service Worker **미등록** (`navigator.serviceWorker.controller=null`, `getRegistrations().length=0`) → 오프라인 캐싱 X·**FCM 푸시 수신 불가**. **출시 전 필수**. 추정: app/layout에서 `register('/sw.js')` 호출 누락 또는 next-pwa·next 16 App Router 호환.
    - **P2 [PWA]** manifest 아이콘 1개만 → 192·512 권장 (Lighthouse·iOS 홈화면 품질).
    - **P3 [UI]** `/admin` 헤더 nav scrollWidth=430px → 실 375px 폰에서 가로 스크롤. sm 미만 햄버거/아이콘only/2줄 wrap 검토 (팀원1 영역).
  - 🔜 **CC 작업 인계**: ① **#61-67** `supabase db push`로 전체 마이그 5개 적용(빈 prod DB) + 타입 regen + Vercel env 3개 확인 + Redeploy. ② **P1 SW 등록**(별도 PR 후보·PWA 출시 차단). ③ **#43** vercel.json cron 2개 인식 + Hobby/Pro 체크. **상세 인계 = `docs/SESSION-HANDOFF.md` 🔄 현재 인계.**

- 📍 **세션 종료 (2026-06-05 밤 — ⭐ 다음 세션 여기부터 + Cowork부터 시작)**: **오늘 푸시 풀스택 + 정산 매트릭스 + 총무 + 취소알림까지 머지, 운영 DB 라이브, 로컬 전체흐름 QA 실증, 버그 1건 잡음. 🎉 열린 PR = 0개, main green.**
  - ✅ **오늘 main 머지**: #33 푸시 백엔드 · #34 Phase C 클라이언트(SW·옵트인배너) · #36 .gitattributes(CRLF 방지) · #35 총무 컬럼 마이그(이슈 #25 closed) · #37 학생취소→양쪽 간사 알림 · #38 타입 정식화(prod regen, `matches.payment_due_at` nullable 교정) · #39 총무 연락처 입력폼(팀원1) · #40 세션 시크릿 가드 · **#28 정산 매트릭스(`/admin/settlement` 실구현)** · #41 DRY 헬퍼 추출(`lib/datetime`·`lib/supabase/relation`) · #42 worklog 인계. (오늘 총 15건 머지, 열린 PR 0)
  - ✅ **운영 DB 라이브**: prod Supabase(`zovrgrbrzxpzmgpkxmns`)가 paused였음 → resume + `supabase db push`로 **전체 마이그 5개 일괄 적용**(빈 DB였음 = 마이그 0). 히스토리 채워짐, Vercel 자동 재배포.
  - ✅ **로컬 전체흐름 QA 실증** (Docker+로컬 supabase+seed+dev서버+브라우저 preview): 마스터/admin · 간사 전체(등록→**매칭큐 수동승인 K1**→입금확인→**예약번호 발급**→정산 ledger) · 학생(예약조회→취소) **전부 실제 동작**. #37 취소알림 DB에 4건(양쪽 간사×인앱+푸시) 발송 실증.
  - 🐛 **버그 잡음**: `OPERATOR_SESSION_SECRET`이 `.env.local`에 누락 → 간사 로그인 "Zero-length key" 에러. **로컬 .env.local에 추가 완료**(랜덤). 코드 명확-실패 가드 = #40. ⚠️ **Vercel prod엔 아직 — 다음 세션 Cowork에서 추가 필수**.
  - ⭐⭐ **다음 세션 = 팀장 Cowork 작업부터 (나머지 PR 다 머지됨, 열린 PR 0)**: ① Vercel에 `OPERATOR_SESSION_SECRET` 추가/확인(없으면 prod 간사 로그인 깨짐) ② 라이브 스모크(마스터+전체 렌더). **상세 Cowork 프롬프트(팀장 전용·팀원 비공개) = vault `projects/bus-cignal/team-lead-prompts/cc-to-cowork-vercel-env-and-smoke.md`.** 시작 = 터미널 `openssl rand -base64 32`.
  - 🔜 **Cowork 이후 본작업**: **CCC 인증**(⛔ CCC IT 신원전달방식 답 대기 — 유일 외부 블로커) · **RLS 실적용**(출시 전, 현재 admin client 우회) · **Phase C 배너 `/me` 마운트**(팀원2, `<PushOptInBanner audience="passenger"/>`) · 실기기 푸시 QA · `anonymize_after` 설정 · 모바일 admin 표 가독성 폴리시.
  - 🧩 **로컬 QA 환경 (gitignored, 보존됨)**: `.env.development.local`(로컬 supabase URL/keys 오버라이드) · `.claude/launch.json`(preview dev 서버). 로컬 supabase 컨테이너 켜진 상태일 수 있음(`supabase stop`). **재개**: `supabase start && supabase db reset`(seed 재로드) → `/dev/login` (seed: 간사 김광주·박부산 / 마스터 / 학생 BUS-7K9M·이지은·끝4 4444).
  - 📌 **팀 진도**: 팀원1 ~95%(operator/admin 완성 — 정산 매트릭스 #28 포함) · 팀원2 ~50%(passenger 실증, 채팅·지도·가입폼 = CCC 후) · 팀장/CC ~92%(인증·알림·cron·PWA·마이그 완성, CCC·RLS 남음). **유일 블로커 = CCC IT 협의.**

- 📍 **Phase B 푸시 백엔드 구현 완료 (2026-06-04 후속 — 여기부터 읽으세요)**: **인앱에 이어 푸시 채널 실발송 코드 전부 구현. 브랜치 `feat/notifications-push-backend`, 4게이트(typecheck·lint·test 110·build) green. push·PR·머지 = 팀장.** (base = 직전 main, 직전 worklog 커밋 `994f073`은 아직 origin 미반영 → 팀장이 main push 시 함께)
  - ✅ **구현 (CC, 우리=팀장 역할)**: ① 마이그 `20260605000000_push_subscriptions.sql`(operator XOR passenger, token unique, `num_nonnulls=1`, RLS enable 무정책) ② `lib/firebase/admin.ts`(Admin 싱글톤 + `isPushConfigured`) ③ `lib/notifications/push.ts`(formatPush·sendPush) ④ `deliverPushBatch()` 실발송(토큰 multicast → `reducePushAttempt` 상태전이 → 소진 시 마스터 `system_error`, 무효토큰 정리, 옵트아웃 resolve) ⑤ `isRetryDue()` 백오프 게이트 ⑥ `POST/DELETE /api/push/subscribe`(세션 기준) ⑦ `/api/cron/push-retry` + `payment-reminder` piggyback ⑧ 테스트 +20. `firebase-admin@13.10.0` 추가.
  - 🧩 **핵심 설계 결정**: (a) **emit()이 호출될 때마다 due된 pending 전부 재시도** → 알림 활동 중엔 cron 없이 자가 치유. (b) **Vercel Hobby cron 2개 한도**(payment-reminder·anonymize로 가득) → push 재시도 daily 구동은 payment-reminder에 **piggyback**, 독립 `/api/cron/push-retry`는 수동/Pro용(분리 cron 미등록). (c) **env 미구성 시 `isPushConfigured()=false`로 no-op** → 인앱 알림·로컬·기존 테스트 무영향(그래서 기존 index.test 6건 그대로 통과). (d) 1m/5m/30m 백오프는 Hobby daily에선 "최소 대기"로만 실현(상태머신은 정확).
  - ⏭️ **다음 (순서)**: 1) **팀장**: 이 브랜치 push → PR → 머지(아래 PR 본문 준비됨). 2) **Cowork**: 마이그 적용(`supabase db push` 또는 GUI) + **타입 regen**(`supabase gen types` — 현재 `database.types.ts`는 수기 미러) + Vercel prod env 3개(`FIREBASE_ADMIN_PRIVATE_KEY`·`FIREBASE_ADMIN_CLIENT_EMAIL`·`NEXT_PUBLIC_FIREBASE_VAPID_KEY`). 3) **Phase C(팀원2 + 우리 PWA인프라)**: `/me` 옵트인 배너("홈화면추가+알림허용") + `firebase-messaging-sw.js` + getToken→`/api/push/subscribe`. 4) 이슈 #25 trips 총무 연락처 컬럼 마이그. 5) CCC 인증 본구현(⛔ CCC IT 답 대기). 6) 출시 전 RLS 실적용·E2E.
  - ⚠️ **검증 한계**: 실제 FCM 발송은 실기기 토큰 + Admin 크리덴셜 필요 → **로컬은 mock 단위테스트까지**. 라이브 발송 검증은 Phase C(클라이언트 옵트인) 이후 실기기로 — 기존 알림엔진과 동일 패턴.
- 📍 **세션 인계 (2026-06-04 종료)**: **operator 핵심 흐름 + 마스터 화면 + 인앱 알림까지 main 완성. 다음 = 푸시 백엔드 + 총무컬럼 마이그.** (`origin/main` = fa5e191, 열린 PR 0)
  - ✅ **이번 세션 누적 머지**: operator 전체(등록·공개·신청·매칭큐·송금·입금확인·예약번호·정산, #15·#18 + #23 복구) · 마스터 화면(admin 대시보드·간사승인/권한해제·거절목록, #21) · **인앱 알림 전 구간 연결**(request_new·match_confirmed·match_rejected·rejection_occurred·payment_reported·paid_code_issued·seat_freed·match_cancelled_p2·operator_revoked) · 스택금지 규칙(#24) · 복구 기록(#26).
  - 🧨 **사고 1건(해결됨)**: #16/#17/#19가 스택 PR이라 squash 머지 시 main 누락 → #23으로 복구. 재발방지 규칙 `docs/GIT-WORKFLOW.md`·`AGENTS.md`에 박음. (바로 아래 항목 참고)
  - 🔜 **다음 세션 우선순위 (순서대로)**:
    1. **⭐ Phase B 푸시 백엔드** (착수 직전 중단, 우리=팀장/CC, core 마이그): `push_subscriptions` 테이블 마이그(operator/passenger별 FCM 토큰) + 타입 재생성 + `/api/push/subscribe`(세션 기준 저장/해제) + `lib/notifications`의 `deliverPushBatch`를 Firebase Admin 실발송으로 구현(재시도 `reducePushAttempt` 이미 있음) + 단위테스트. **결정: 인앱·푸시 "다 붙이기"** (인앱은 이미 완료, 푸시만 남음).
    2. **이슈 #25 [core] trips 총무 연락처 컬럼 마이그** → 그 후 팀원1이 등록 폼에 입력란 확장. (우리가 마이그 먼저)
    3. Phase C 푸시 클라이언트(`/me` 옵트인 배너 "홈화면추가+알림허용") = 팀원2 + 우리 PWA인프라(SW/manifest). B 끝나면.
    4. **CCC 인증 본구현**(`verifyCccToken`→`/login`→미들웨어 가드) — ⛔ CCC IT 전달방식 답 대기.
    5. 팀원2 작업: 학생 취소(`/me/cancel`)·카카오맵·채팅.
    6. **출시 전**(PRE-LAUNCH-CHECKLIST.md): RLS 실적용(현재 admin client로 우회 — matches/정산 목록 전국조회 후 JS필터 = PII 서버유입) · Vercel prod `PASSENGER_SESSION_SECRET` 추가 · `anonymize_after` 날짜 설정 · 실데이터 E2E(S1·S4·S5).
    7. **전체 흐름 점검(기획안=docs/SPEC.md 대로)** + **Cowork 협업**: operator 흐름 브라우저 클릭 검증(dev로그인+seed) · 모바일 가독성 · Vercel 라이브 확인.
  - 🧩 **핵심 컨텍스트**: 역할경계 = 팀원1(operator/admin/matching/settlement)·팀원2(passenger/me/chat/kakao)·우리(인증·세션·알림엔진·cron·PWA인프라·마이그·통합·리뷰). 알림 엔진 = `lib/notifications`(emit, 18이벤트). 학생세션 정본 = `lib/auth/passenger*`(결정 §4). **operator_revoked** = 마스터가 간사 권한 해제(`approval_status='revoked'`) → 해당+동지구 간사 알림(인수인계용). 로컬 supabase 중지됨(재개 `supabase start && supabase db reset`). `.env.local` 마스터해시는 `\$` 이스케이프됨.
- 📍 **상태 (2026-06-04 저녁 — 스택 머지 사고 복구 완료)**: **operator 전체 흐름이 main에 완전체로 들어옴. 단, #16/#17/#19가 스택 PR로 꼬여 한 번 누락됐다가 복구됨 — 아래 경위 꼭 확인.**
  - ⚠️ **무슨 일이 있었나**: 팀원1 operator PR들이 **스택**(서로의 브랜치 위에 쌓임: #16←#15, #17·#19←#16)이었음. squash 머지하니 **#16=CLOSED, #17·#19는 main이 아니라 `feat/operator-matching-queue`로 머지**돼 매칭큐·신청·송금/예약번호 코드가 **main에 누락**됨. (#15·#18·#20만 정상 도달) 코드 손실은 없었음(그 브랜치에 보존).
  - ✅ **복구**: 누락 코드를 main 위로 재구성 → **PR #23 머지**. 검증: `trips/[id]`가 placeholder→실제 매칭큐로 교체 확인, 게이트 typecheck·lint·**test 90**·build 통과. `feat/operator-matching-queue` 삭제.
  - ✅ **재발 방지**: **"스택 PR 금지(항상 main에서 분기)" 규칙을 `docs/GIT-WORKFLOW.md`·`AGENTS.md`에 추가**(PR #24) → 팀원 AI가 자동 준수.
  - ✅ **함께 머지**: #21 마스터 화면(admin 대시보드·간사승인/권한·거절목록) · #22 worklog. **열린 PR 0, main 게이트 green.**
  - 🔜 **다음(우리=팀장/CC)**: 알림 **인앱 나머지**(#16 승인/거절=match_confirmed·match_rejected·마스터) + **푸시 백엔드**(push_subscriptions 마이그+subscribe API+FCM 발송) — "인앱·푸시 다 붙이기" 결정. 이어 전체 흐름 점검 + Cowork 협업 일감.
  - 📝 참고: 바로 아래 2026-06-04 항목의 "operator 전부 머지됨" 서술은 *사고 전 시점 기준*이라 부정확 — 실제 경위는 위 기록이 정본.
- 📍 **상태 (2026-06-04 CC 세션 — 여기부터 읽으세요)**: **팀원1(운영자) 영역 대거 진척 — operator 핵심 흐름이 등록→공개→신청→매칭→송금/입금확인→예약확정→정산까지 끝까지 연결됨. 이어서 #7 마스터 화면(`/admin/*`)도 4/5 착수. operator PR 5개 + admin PR #21, 전부 push·팀장 머지 대기.**
  - ✅ **이번 세션 작업 (PR, 전부 머지 대기)**:
    - **#15** trips 등록·공개 — 셀프리뷰로 `publishTrip` 원자적 공개(좌석 중복 버그)·정원 상한 수정 반영
    - **#16** 매칭 큐 (`/operator/trips/:id`) — 시각순 큐·수동 승인/거절·**승인 안내 모달(K1)**
    - **#17** 타지구 신청 (`/operator/requests`+`/new`) — 학생 명단·우선순위·동의 + **공급 지구 알림(request_new)**
    - **#18** 정산 (`lib/settlement`+`/operator/settlement`) — 받을/보낼 표·CSV. **core(팀장 승인 필요)**, base=main 독립
    - **#19** 매칭 후반(§S4) — 송금완료·입금확인·**예약번호 BUS-XXXX 발급**·자리풀기·매칭취소 + **`match_passengers` 생성**(학생 `/r` 검증 가능케 하는 누락 고리 보완)
  - 🧪 전부 **4게이트(typecheck·lint·test 81·build) + 로컬 라이브 검증(Playwright)** 통과. dev 로그인·seed 기반 E2E로 신청·매칭·정산·송금 흐름 실동작 확인.
  - 🐛 **버그 수정**: 이미 매칭된 학생이 큐에 재노출(이중 매칭 위험, SPEC §S3 위반) → 큐 제외 + `approveRequest` 서버 가드.
  - ✅ **후속 세션 — #7 마스터 화면 착수 (PR #21, base main 독립, core 아님)**: `app/admin/*` placeholder 4종 → 실구현.
    - **대시보드**(§5.9): 활성 Trip·매칭·오늘 거절·대기 간사 head count + 익명화 D-day(`system_config.anonymize_after`, KST 기준).
    - **operators**(§5.10): 활성 간사 + [비활성화](사유 5자+ 확인 모달 → `revoked` + 본인·동지구 간사 `operator_revoked` 알림, best-effort).
    - **operators/pending**(§2.2): 승인/거절. 승인 = 신청 지구를 소속으로 확정, `approval_status='pending'` 가드를 UPDATE에 포함해 이중처리 방지.
    - **rejections**(§5.11): `rejection_log` 기반 거절 목록(시각·공급/신청 지구·인원·사유).
    - `app/admin/layout.tsx` 공용 셸(네비+로그아웃) + 서버액션 매 호출 `verifyMasterSession` 재검증(다층 방어). 접근 보호는 기존 미들웨어(`/admin/*`).
    - 🐛 검증 중 발견·수정: `operators→regions` FK 2개(`region_id`·`requested_region_id`) 모호 → 제약명 명시. **개인정보 최소화(§2.4·§5.10)**: operators 활성목록 전화 컬럼 제거(후속 커밋 `23d14a9`).
    - 🧪 4게이트(typecheck·lint·test 68·build) + **로컬 마스터 세션 라이브 검증** PASS(임시데이터 삽입 → 4화면 렌더·조인 지구명·D-day 확인 → 정리).
    - ⏭️ **`/admin/settlement` 제외** = `lib/settlement`(PR #18) 의존 → 작성 시점엔 #18 미머지였음. **이후 #18 머지 완료(main 반영)** → 이제 `/admin/settlement`(전국 N×N 매트릭스·§S5) 바로 착수 가능. placeholder 잔존: `/admin/trips·matches·regions·system`.
    - ⚠️ **핸드오프**: `/admin/rejections`는 `rejection_log` 행을 읽음 → operator 거절 흐름(#16/#19)이 거절 시 `rejection_log`에 기록해야 목록에 노출(현재 기록 여부 미확인). 기록 없으면 빈 목록=정상.
    - 📋 거버넌스 셀프점검(GIT-WORKFLOW·ROLES·CONTRIBUTING·TEAM-TASKS 대조): **하드룰 위배 0**. ROLES "간사 승인=팀장 운영권한"은 *런타임 행위* 한정 — *UI 구현*은 TEAM-TASKS #7로 팀원1 배정 = 일관(마스터 세션 게이트). 메모: PR 크기(권장 300줄) 초과·PR 본문 템플릿은 다음부터 반영.
  - ⏳ **보류 (팀장 회의 대기)**: **알림(emit) 범위 결정** — 웹 푸시는 옵트인(홈화면추가+권한) 마찰이 커 구현 가치 논의 필요. 인앱=무옵트인·저비용 / 푸시=마찰 큼. 그래서 매칭 큐 **승인·거절 알림(match_confirmed/match_rejected/마스터)은 미연결** 상태(SPEC §S3·§S8 갭). 실용화는 알림과 독립(핵심 흐름 동작).
  - 🔜 **다음 (팀원1 남은 작업)**: **#7 마스터 잔여** — `/admin/settlement`(#18 머지 완료 → 즉시 가능) · `/admin/trips·matches·regions·system` placeholder · operator 잔여(`/operator` 대시보드·`/profile`·`/requests/[id]`) · 선택: 신청 검색 필터·Trip 수정.
  - 📦 **머지 현황 (2026-06-04 말)**: 팀장이 **operator 흐름 전체(#15·#16·#17·#18·#19) + 워크로그(#20) main 머지** → main 대폭 전진. **열린 PR = #21(admin)뿐.** ⚠️ #21은 옛 main(05ea6c4) 기준 → 머지 전 **현재 main으로 rebase 권장**(클린, 깔끔히 됨 확인). 본 워크로그 후속 기록은 main 기준 별도 docs PR로 분리.
  - 🔀 **PR 스택/순서(과거)**: `#15 → #16 → #19`(체인), `#17`은 #16 후, **`#18` 독립(core)**, **`#21` 독립(admin, core 아님)**. 앞 브랜치 머지 시 GitHub가 child base를 main으로 자동 재타겟 → 위처럼 전부 머지됨.
  - 📌 **블로커**: 차량 등록 폼의 **총무·담당 간사 연락처 입력란** = `trips` 컬럼 마이그(core) 필요 → PR #15에 마이그 SQL+결정 3건 코멘트로 팀장 요청함.
- 📍 **상태 (2026-06-03 CC 세션 — 여기부터 읽으세요)**: **학생 세션(JWT)+로그아웃 추가, 익명화 강화, 결정 기록 정리 완료. 인프라는 거의 다 깔림 — 이제 팀원1(운영 흐름)·CCC답(간사 인증) 대기 단계.** (`origin/main` = 56d3630)
  - ✅ **이번 세션 머지 (PR #5~#9)**: 알림엔진+마스터E2E(로컬 해시 `$` 버그 수정) · 익명화 PIPA강화 · WORKLOG동기화 · **학생세션(`lib/auth/passenger*`)+로그아웃3종(`lib/auth/logout.ts`)+온보딩env** · **결정기록**(`docs/decisions/2026-06-03-student-access-and-ccc-integration.md`).
  - 🔑 **학생 인증 방침 확정**: 학생 세션·JWT는 **우리가 올린 `lib/auth/passenger*` 기준**으로 진행. 팀원2 테스트 버전과 **비교·병합 안 함**(우리 버전 정본). 팀원2는 학생 페이지에서 `issuePassengerSession`/`requirePassenger`/`logoutPassenger` **호출만**. (결정 §4)
  - ⛔ **대기 2건**: ① **CCC IT 신원 전달방식**(서명토큰/일회용코드/OIDC — 평문 금지) → 간사 인증 본구현 전제 ② **팀원1 PR**(차량등록·신청·매칭 = operator 영역) → 핵심 운영 흐름. (상세·대기항목 = 결정문서)
  - ▶️ **다음 할 일 (시점별)**:
    - **지금(대기·지원)**: 팀원1/2 PR 리뷰·머지 / 간사께 CCC 항목 ①②③·④·⑦⑧⑨ 받아오기 / 팀원1이 trips 폼 만들면 **총무 연락처 컬럼 마이그(팀장, core)**.
    - **CCC 답 오면 ⭐(우리 다음 큰 작업)**: `verifyCccToken` 구현 → `/login` 연동 → 미들웨어 `/operator` 가드 → RLS 앱레이어 + 학생 CCC 라우팅(`operators` 조회로 간사/학생 분기 → 예약페이지).
    - **출시 전**: PWA 푸시 실발송(`push_subscriptions` 마이그 + FCM) / Vercel prod에 `PASSENGER_SESSION_SECRET` 추가 / 실데이터 E2E(S1·S4·S5) / 수련회 종료일 → `anonymize_after` 설정.
  - 🧩 **역할 경계**: operator 페이지+기능백엔드(매칭 `lib/matching`·정산 `lib/settlement`)=**팀원1**(매칭·정산·스키마·RLS=core→팀장 리뷰). 학생페이지·채팅·카카오=**팀원2**. 인증·세션·미들웨어·알림엔진·cron·PWA인프라·마이그=**팀장/CC**.
- 📍 **상태 (2026-06-01 CC 세션)**: **알림 엔진 완성 + 마스터 로그인 E2E 통과 + 로컬 마스터해시 버그 발견·수정.** 외부 블로커(팀원·CCC)는 그대로, CC가 코드로 진척.
  - ✅ **알림 엔진 완성** (`lib/notifications/`): SPEC §8 18개 이벤트 전부에 대한 **타입안전 `emit()`** (이벤트별 수신자 슬롯 컴파일타임 강제) + 다중 타겟 fanout(양쪽 간사·학생·마스터) + master(둘 다 null row) + 푸시 재시도 백오프(1m→5m→30m, `retry.ts`) 순수로직. 순수 모듈(`events`·`targets`·`retry`) + server-only(`index`) 분리. **Vitest 22개 신규(총 24) 통과.** cron(payment-reminder) `notify()`→`emit("payment_delay", 양쪽 간사)` 이전. 4게이트(typecheck·lint·test·build) 통과. ⚠️ 트리거 wiring(operator·student 페이지 삽입)은 팀원1·2 영역 — 안 건드림(엔진 API만 제공).
  - 🐞 **버그 발견·수정 (중요)**: **로컬 dev 마스터 로그인이 깨져 있었음.** `MASTER_PASSWORD_HASH`의 `$`(`$2b$12$`)가 `@next/env`(dotenv-expand) 변수확장에 먹혀 런타임에 `/WWy…`로 잘림 → `bcrypt.compare` 항상 실패. **수정**: `.env.local`에서 `$`→`\$` 이스케이프 (resolve `$2b$12$…` 정상 복구 확인). **프로덕션(Vercel)은 무관** — Vercel은 env를 process.env에 직접 주입, `@next/env`가 기존 process.env를 안 덮음 → 해시 리터럴 유지. (⚠️ 향후 `$` 포함 시크릿 추가 시 .env에선 항상 이스케이프)
  - ✅ **마스터 로그인 E2E 통과** (`tests/e2e/master-auth.spec.ts`, 3 케이스): ① 미인증 `/admin`→`/admin/login` 가드 ② 틀린 비번→오류+남은횟수 ③ **올바른 비번→`/admin` 세션 발급·가드 통과.** dev 서버엔 결정적 테스트 해시를 `.env.development.local`로 주입(`global-setup.ts`, 시크릿 무관, teardown 정리). `pnpm test:e2e` 6/6 통과.
  - ✅ **Vercel 마스터 해시 점검**: `_secrets/vercel-env-prod.md` 원본 = `$2b$12$…` 정상(첫 `$` 살아있음), 로컬 `.env.local` 해시와 sha256 동일 = 정본 1개. **Vercel엔 RAW 값(이스케이프 X)** 이 들어가야 함(대시보드 env는 dotenv 안 거침). **확정 확인 = 라이브 로그인 1회(Cowork)** — 실패 시 _secrets/1Password의 RAW 해시를 (옵시디언 **소스모드**에서 복사) Vercel `MASTER_PASSWORD_HASH`(Sensitive·Production)에 재입력 + 재배포.
  - ▶️ **다음**: (A) 팀원 PR 리뷰·머지 (수락 완료 → 개발 시작 가능) / (B) CCC 답 오면 `verifyCccToken` / (C) 알림 엔진을 operator·student 플로우에 wiring(팀원) / (D) PWA push_subscriptions 테이블 마이그(core, 별도) → FCM 실발송.
  - ✅ **머지됨 (PR #5 squash → `origin/main` = 8398d53)**: `lib/notifications/{events,targets,retry,index}.ts` + `*.test.ts`, `app/api/cron/payment-reminder/route.ts`, `playwright.config.ts`, `tests/e2e/{master-auth.spec,master-auth.fixtures,global-setup,global-teardown}.ts`, `.env.example`. (`.env.local` 이스케이프 = gitignore, 로컬만)
- 📍 **상태 (2026-05-31 CC 세션 종료 — 여기부터 읽으세요)**: **v1.1 + Foundation Phase 3 + public·merge보호·Vercel 라이브까지 전부 끝. 팀원 합류만 남음.** (`origin/main` = edf45f7, PR #4)
  - ✅ **코드**: 테스트 인프라(`seed-dev`·`/dev/login`·`lib/auth/operator.ts`) + PWA + 알림엔진(`lib/notifications`) + cron(daily) + Playwright·Sentry + `docs/GIT-WORKFLOW.md`. 게이트 통과. 로컬 `supabase db reset` 실검증 OK.
  - ✅ **GitHub**: **public + main ruleset 활성**(PR 필수·팀장 코드오너 승인 필수, 팀장 admin bypass) = merge는 팀장만.
  - ✅ **Vercel 라이브**: https://bus-cignal.vercel.app = **200 OK**. Production env **18개 전부 입력 완료**(Supabase·Firebase·세션시크릿·마스터해시·카카오 2개). `framework=nextjs`로 빌드 해결.
  - ⚠️ **MASTER_PASSWORD_HASH 주의**: 옵시디언 마크다운이 첫 `$`를 삼켜 `2b$12$...`(첫 `$` 누락) 형태로 들어갔을 수 있음. **마스터 로그인 실패 시 재생성** → `node -e "console.log(require('bcryptjs').hashSync('비번',12))"` → Vercel 재입력.
  - ⏳ **팀원 합류 대기**: collaborator 초대 발송됨(`dddyoung2`, `dbtjd410-hub`) — **수락 대기 중**. 노션 온보딩 문서 공유 완료. 수락하면 바로 개발 시작.
  - ✅ **카카오 키 = Vercel 추가 완료** (팀원2 본인 앱 JS·REST, env 18/18, 라이브 200 유지). ※ **지도 동작하려면** 팀원2가 카카오 **JavaScript 키 → "JavaScript SDK 도메인"**(또는 앱설정→플랫폼→Web)에 도메인 2개 등록 필요 — 현재 '제품 링크 관리'에만 등록(그건 카톡 공유용).
  - ⛔ **블로커**: CCC 인증 본구현 = CCC IT 답(A 서명토큰/B 일회용코드/C OIDC) 대기. 그동안 dev 세션 우회로 개발 가능.
  - ▶️ **다음 자연스러운 작업**: (A) 팀원 수락→clone→개발 → **팀장 PR 리뷰·머지** / (B) CCC 답 오면 인증 연동(`verifyCccToken`→`/login`→미들웨어 `/operator` 가드→RLS) / (C) 마스터 로그인(`/admin/login`) 테스트 → 해시 깨졌으면 재생성·Vercel 재입력 / (D) 팀원2 지도 SDK 도메인 등록 확인.
- **🆕 v1.1 기획 개정 (2026-05-30, 간사 피드백)**: ① 간사 = **CCC 로그인** (Google OAuth 폐기) ② 매칭 = 시각순 정렬 + 간사 **수동 선택** (FIFO 강제·자동 부분/후속매칭·자동 거절 제거, priority=힌트) ③ 송금 = **자동 만료 폐지** → 소프트 리마인더 + 수동 [자리 풀기] ④ 학생·간사 PWA = **옵트인** ⑤ 이메일·성별 **미수집** ⑥ 지구 내 차량관리 = V1.5. → `docs/SPEC.md`·`docs/OVERVIEW.md` v1.1 반영 완료, vault 사본 동기화.
- **다음 단계 (P2-5 간사 인증 = CCC 로그인)**: ⛔ **CCC IT 답 대기** — 신원 전달 방식(A 서명토큰 / B 일회용코드 / C OIDC) 확정 필요. 그 전까지 완료: 마이그(`20260530000000_ccc_login_operators.sql` = `operators.google_uid`→`ccc_id` + `campus`·`ccc_role`)·세션 골격(`lib/auth/operator-session.ts`)·검증 스텁(`lib/auth/ccc.ts`)·`/login` placeholder·types·.env.example. **방식 확정 후**: `verifyCccToken` 구현 → `/login` 연동 → 미들웨어 `/operator` 가드 → RLS(앱레이어). 마이그는 Cowork이 Supabase 적용 + 타입 재생성.
- **로컬 Supabase 중지됨** (세션 종료 시 정리, 데이터 보존 — 재개 `supabase start && supabase db reset`)
- **마지막 세션 종료**: 2026-05-31 (CC — Foundation 전부 완료: v1.1+Phase3, public+ruleset, Vercel 라이브 200 + env 18개(카카오 포함). 남음: 팀원 수락·CCC답·마스터해시 검증·팀원2 지도 SDK 도메인)
- **사용자 대기 중 (외부 합의)**: 신의 악단(앱 1442060) 영구 삭제 가능 여부 = 교수님 합의 필요. 신의 악단 = 학교 프로젝트로 만든 앱, 사용자 단독 결정 불가.

### ⚠️ 카카오맵 전략 재검토 (2026-05-28 검색 결과)

카카오 데브톡 직원 답변 2건 ([149625](https://devtalk.kakao.com/t/on/149625), [149685](https://devtalk.kakao.com/t/topic/149685)) 분석:

> "카카오맵 추가 권한은 해당 권한을 이미 소유한 다른 앱과 **비즈니스 주체가 다르고 무관한 서비스인 경우에만** 추가 부여" (woody.ho, 카카오)

우리 케이스:
- 비즈니스 주체: 같음 (둘 다 팀장 본인) ❌
- 서비스 무관: ✅ (음악 vs 차량 매칭)
- **두 조건 모두 충족 필요 → 추가 기능 신청해도 반려될 가능성 높음**

### 새 전략 (사용자 합의 후)

1. **신의 악단 영구 삭제** (교수님 합의 필요) → "이미 권한을 갖고 있는 다른 앱" 자체를 없앰
2. Bus Cignal 카카오맵 [상태] ON 토글 시도
3. 풀리면 = 케이스 A 즉시 활성화 (이미 제출한 비즈니스 정보 심사도 무효화/대기 무관)
4. 안 풀리면 = 카카오 내부 cache·history가 남아있는 경우. 데브톡 문의 또는 추가 기능 신청 흐름 복귀

### 이미 제출된 작업 (유효)
- 비즈니스 정보 심사 (영업일 3~5일 대기) — 신의 악단 삭제 + 토글 ON 성공 시 무관해짐
- Vercel 임시 랜딩 배포 — Foundation Phase 2까지 유지

**다음 단계 진입 조건**: 사용자가 교수님 합의 결과 알려주면 새 전략 실행 / 또는 패턴 A (팀원2 카카오 앱 키 받기) 답변 받으면 그 키로 진행

### 📨 팀원2 카카오 키 부탁 카톡 전달 완료 (2026-05-31)
- 패턴 A 선택: 팀원2가 본인 카카오 계정으로 새 Bus Cignal 카카오 앱 생성 + 카카오맵 토글 ON → 키 두 개 전달
- 카톡 안내문 작성 + 사용자가 팀원2에게 전달
- 받을 키: `NEXT_PUBLIC_KAKAO_MAP_API_KEY` (JS), `KAKAO_REST_API_KEY` (REST)
- 도메인 등록 포함 (localhost:3000 + bus-cignal.vercel.app)
- 5~10분 소요 예상, 팀원2 답변 대기 중

### 🎉 Vercel Production 라이브 정상화 완료 (2026-05-31, 2차 시도)

- **빌드**: Ready (1m 9s) — PR #4 (vercel framework 수정 + 카카오키 정리) 후 정상
- **라이브 URL**: https://bus-cignal.vercel.app → **200 OK** ✅
- 페이지 정상 렌더링: 🚌 출시 준비 중 / Bus Cignal h1 / 서비스 소개 / [간사 로그인] [예약 조회] 버튼
- Foundation Next.js SSR 동작 확인 (Supabase 클라이언트 초기화 성공)

**입력된 env vars 16개 (Production 전용)**:
- Supabase: URL, anon JWT ★ (500 푼 핵심), service_role JWT
- Firebase 공개값 7개 + VAPID + admin_client_email + admin_private_key
- 랜덤 시크릿 3개 (master·operator session, cron)
- 마스터 비번 해시 (★ 형식 점검 필요 — `2b$12$...` 첫 $ 누락 가능, 인증 단계에서 재확인)

**보류·미입력 2개** → ✅ **2026-05-31 추가 완료**:
- NEXT_PUBLIC_KAKAO_MAP_API_KEY = `(키값=_secrets·1Password)` (팀원2 발급, 1Password 저장)
- KAKAO_REST_API_KEY = `(키값=_secrets·1Password)` (팀원2 발급, 1Password 저장)
- Vercel Production env vars 총 18개 (Sensitive ON, Production 전용)
- Redeploy 후 라이브 200 유지 확인 (1m 16s 빌드, https://bus-cignal.vercel.app 정상)

**알려진 잔여 이슈**:
- ✅ **MASTER_PASSWORD_HASH 정상화 완료** (2026-05-31):
  - 1차 검증: /admin/login 시도 → "비밀번호 올바르지 않습니다" (4회 남음) — 해시 깨짐 확정 (옵시디언 미리보기 모드가 `$2b$12$...` 양쪽 `$`를 LaTeX로 삼킴)
  - 옵시디언 RAW(소스) 모드로 재복사 → Vercel UI Edit으로 RAW 해시 paste → Save → Redeploy
  - 2차 검증: 로그인 성공 ✓ /admin 진입 확인
  - 1Password에는 RAW 해시(`$2b$12$...`)로 저장 OK. Vercel env에도 RAW 그대로 입력됨
- ⚠️ FIREBASE_ADMIN_CLIENT_EMAIL은 기존 깨끗한 값 유지 (사용자 새 paste는 마크다운 hyperlink 포맷이라 그건 안 씀)
- Hobby cron 제약은 PR #4에서 사용자가 daily로 수정해놓은 듯 (커밋 메시지 "vercel framework 수정")

### 🟡 Vercel Production env vars 11개 입력 + 재배포 시도 → Build Failed (2026-05-31)

**완료**:
- env vars 11개 bulk paste 성공 (Production 환경만, Sensitive 토글 ON)
- 입력 완료된 변수:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_FIREBASE_* (6개)
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - MASTER_SESSION_SECRET, OPERATOR_SESSION_SECRET, CRON_SECRET (랜덤)
- Redeploy 트리거 (main 71f0bff, PR #3 = v1.1 + Foundation Phase 3 정합성·테스트인프라·PWA·알림·cron·E2E·Sentry)

**🚨 Build Failed (1m 3s)**:
> "No Output Directory named 'dist' found after the Build completed. Configure the Output Directory in your Project Settings. Alternatively, configure vercel.json#outputDirectory."

**원인**:
- 임시 랜딩 페이지 셋업 시 Framework Preset = "Other" + Output Dir = "." 로 설정해뒀음
- 지금 main = Next.js Foundation 코드 → 빌드 output은 `.next/`에 생성
- Vercel이 옛 설정대로 `dist/` 찾아서 실패

**해결 옵션 (CC가 결정)**:
- **A) Vercel UI에서 Framework Preset → Next.js 변경** (모든 build/install/output 자동) — 권장
- **B) `vercel.json`에 outputDirectory·buildCommand 명시 + cron Hobby용 daily 수정** (코드 수정 + PR)

**같이 처리해야 할 부수 작업**:
- ★ Hobby cron 제약: 현재 `vercel.json`에 `0 */6 * * *` (payment-reminder, 6시간) 있음 → Hobby에서 거부. 둘 다 daily로 수정 필요
- 아직 미입력 시크릿 6개 (anon, service_role, admin private key, 카카오 2개, MASTER_PASSWORD_HASH) → 빌드 정상화 후 입력 단계

**다음 세션 시작 시 CC 즉시 액션**:
1. 사용자에게 옵션 A vs B 결정 받기
2. A이면 → 사용자 Cowork으로 Settings 가서 Preset 변경 안내
3. B이면 → CC가 vercel.json 수정 + PR + merge

### 🗑 팀장 카카오 앱(1470045) 영구 삭제 완료 (2026-05-31)
- 노출됐던 옛 키 즉시 무효화:
  - ~~JS 키 `(옛 키·무효)`~~ → 무효
  - ~~REST 키 `(옛 키·무효)`~~ → 무효
- 비즈 앱 전환·비즈니스 정보 심사 신청 이력도 함께 사라짐 (어차피 안 쓸 거였음)
- 본인 인증·약관 동의 이력은 팀장 카카오 계정에 남음 (영향 없음)
- 카카오 계정에 남은 앱: Carbus(1462065), 신의 악단(1442060) — 둘 다 카카오맵 무관 또는 다른 사람 명의
- **후속 작업**:
  - [ ] 1Password 옛 카카오 항목 archive
  - [ ] git history grep으로 옛 키 노출 흔적 검사 (`git log --all -p | grep "5f64a39e\|2970db3b"`)
  - [ ] 채팅 스크롤백 클리어 (이번·이전 세션)

---

### 🟡 Vercel Production env vars 입력 대기 (2026-05-31)

**진행 완료**:
- ✅ Vercel Production Branch = `main`으로 복원 (이전 임시 `temp/landing-for-kakao` 해제)
- ✅ Hobby Plan 확인 → ⚠️ `vercel.json`의 6시간 cron(`payment-reminder`) Hobby에서 거부됨 → working branch에서 daily로 수정 필요 (또는 Pro 업그레이드, $20/월 + $20 무료 크레딧)
- ✅ 랜덤 시크릿 3개 생성 (1Password 저장 권장):
  - `MASTER_SESSION_SECRET` = base64 48바이트
  - `OPERATOR_SESSION_SECRET` = base64 48바이트
  - `CRON_SECRET` = hex 32바이트
  - (실제 값은 2026-05-31 Cowork 세션 채팅 참조 또는 1Password 저장본)

**다음 세션에서 한꺼번에 bulk paste 예정 (17개)**:

| 변수 | 출처 | 상태 |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | 캡처값 | ✅ 준비 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 1Password (legacy JWT) | ⏳ 사용자 수집 |
| SUPABASE_SERVICE_ROLE_KEY | 1Password (legacy JWT) | ⏳ 사용자 수집 |
| NEXT_PUBLIC_FIREBASE_API_KEY ~ APP_ID (6) | 캡처값 | ✅ 준비 |
| FIREBASE_ADMIN_CLIENT_EMAIL | 캡처값 (공개) | ✅ 준비 |
| FIREBASE_ADMIN_PRIVATE_KEY | `~/.secrets/bus-cignal/admin-sdk.json` 의 `private_key` (개행 `\n` escape) | ⏳ 사용자 수집 |
| NEXT_PUBLIC_KAKAO_MAP_API_KEY | 팀원2 카카오 JS 키 | ⏳ 팀원2 답변 대기 |
| KAKAO_REST_API_KEY | 팀원2 카카오 REST 키 | ⏳ 팀원2 답변 대기 |
| MASTER_PASSWORD_HASH | bcrypt 해시 (외부 셋업 5/5) | ⏳ 사용자 수집 또는 생성 |
| MASTER_SESSION_SECRET | 생성됨 | ✅ 준비 |
| OPERATOR_SESSION_SECRET | 생성됨 | ✅ 준비 |
| CRON_SECRET | 생성됨 | ✅ 준비 |

**⚠️ Production에 절대 넣지 말 것**: `ENABLE_DEV_LOGIN` (dev 전용)

**Foundation 빌드 검증 상태**: 최근 main 배포 모두 Error (env vars 0개 상태에서 빌드 시도해서) — env vars 입력 후 재배포 트리거 필요. Production Branch는 이미 main으로 복원됨

### 다음 세션 시작 방법 (사용자 가이드)

```bash
# 1. 현재 세션과 동일 위치에서 CC 시작
cd /Users/east_star/LIFE
claude

# 2. 첫 메시지 (한 마디만)
"작업 이어가자"
# 또는 "Bus Cignal 이어가자" / "외부 셋업 시작하자" / "다음 단계"
```

→ CC가 자동으로 모든 컨텍스트 복원 + 다음 단계 안내. 별도 설명 불필요.

### 다음 세션 첫 액션 (CC 자동 수행):
  1. CC가 자동으로 이 WORKLOG·SESSION-HANDOFF·CHANGELOG 읽음
  2. **`.team-role` 자동 읽기**:
     ```bash
     cat /Users/east_star/projects/bus-cignal/.team-role 2>/dev/null
     # 값: team-lead (예상)
     ```
  3. 팀장 확인 (vault 존재):
     ```bash
     ls /Users/east_star/LIFE/projects/bus-cignal/team-lead-prompts/ 2>/dev/null
     ```
  4. vault 존재 = 팀장 머신 → 외부 셋업 진행 가능
  5. **팀장 vault**의 `team-lead-prompts/setup-README.md` 읽고 5단계 인지
  6. **사용자에게 "외부 셋업 3/5 카카오부터 이어서 진행할까요?"** 안내
     (1/5 Supabase + 2/5 Firebase 완료)
  7. 사용자 OK → vault `team-lead-prompts/setup-3-kakao.md` 제공
  8. 사용자가 Cowork에서 진행 → 키 받음 → 1Password "카카오 · bus-cignal" item 저장
  9. CC에 결과 보고 → WORKLOG 갱신 → 다음 setup (4/5 Vercel)
  10. 5단계 완료 후 → Foundation Phase 1·2·3 진입

- **현재 위치**: `~/projects/bus-cignal/`
- **GitHub**: https://github.com/Lumiere001/bus-cignal (private, push 됨)

---

## 📌 외부 도구 셋업 (5단계, 다음 세션에서 진행)

| # | 작업 | 도구 | 상태 |
|---|---|---|---|
| 1 | Supabase 프로젝트 (Seoul) | Cowork | ✅ 완료 (2026-05-27) |
| 2 | Firebase + Firestore + FCM | Cowork | ✅ 완료 (2026-05-28) |
| 3 | 카카오 개발자센터 앱 | Cowork | 🟡 심사 중 (2026-05-28) — 앱·키·도메인·비즈 앱 ✅ / 비즈니스 정보 심사 신청 완료 (영업일 3~5일 대기) / 카카오맵 권한 신청 대기 |
| 4 | Vercel 프로젝트 + GitHub 연동 + env vars | Cowork | 🟡 부분 완료 (2026-05-28) — 임시 랜딩 배포 ✅ / Foundation Phase 2에서 env vars 입력 예정 |
| 5 | 마스터 비번 + bcrypt hash | CC + vault _secrets | ✅ 완료 (2026-05-28) |

프롬프트 파일: **팀장 vault** `~/LIFE/projects/bus-cignal/team-lead-prompts/setup-1~5-*.md`
(repo에는 없음 — 팀장 전용)

---

## 🚀 Foundation 진입 조건 (외부 셋업 5/5 완료 후)

다음 순서로 진행:

### Phase 1 — ✅ 완료 (2026-05-28, PR #1 squash 머지)
- Next.js 16 스캐폴드 + TypeScript strict + Tailwind
- shadcn/ui 초기 + Pretendard 폰트
- 32개 라우트 placeholder 라우팅
- 디자인 시스템 base (색상·spacing)
- CI 설정 (GitHub Actions: typecheck·lint·test·build)
- ESLint·Prettier 설정
- CODEOWNERS

### Phase 2 — 외부 키 받은 후 (3~5일)
- Supabase 클라이언트 (server/client/types)
- 간사 인증 미들웨어 (**CCC 로그인** + 자체 세션, ⛔ CCC IT 신원 전달 방식 대기 — 그동안 dev 세션 우회로 개발)
- 마스터 비번 인증 미들웨어 (/admin/login)
- DB 마이그 1차 (12개 테이블 + RLS) + seed (53개 지구)
- Firebase 클라이언트 + Custom Token 발급 API
- 카카오맵 SDK 통합 + 지오코딩
- PWA 셋업 (next-pwa + manifest + sw + FCM)

### Phase 3 — 완성 (1~3일)
- **dev 로그인 우회 + seed 테스트 데이터** (간사·Trip·신청·매칭·예약번호) — 팀원이 화면 테스트 가능하게 (v1.1 추가)
- Playwright E2E 스캐폴드 (S1·S4·S5 + iOS 푸시)
- Sentry 통합
- Vercel 배포 동작 확인

### 팀원 초대 시점
**Foundation Phase 3 완료 후** = 가장 안전 (인증·DB·라우팅·CI 다 동작 시점).

### ★ 팀원 초대 직전 — AI가 만들어야 할 산출물

Foundation 끝나고 팀원 초대 직전에 CC가 만들어야 할 것:

1. **`docs/TEAM-INVITE-MESSAGE.md`** — 팀원에게 카톡으로 보낼 안내 멘트
   - 환영 인사
   - GitHub repo 링크 + collaborator 수락 안내
   - 셋업 가이드 (clone·`.team-role`·로컬 Supabase·`.env.local`)
   - 본인 분담 영역 명시 (팀원 1·2 각각 다른 멘트)
   - 첫 작업 추천 (워밍업 PR)
   - 막힐 때 어디 물어볼지

2. **`docs/COLLABORATION-GUIDE.md`** — 팀원끼리 어떻게 작업하는지
   - 시스템 설계 요약 (어떻게 세팅했는지)
   - WORKLOG·SESSION-HANDOFF 자동화 활용법
   - `.team-role` 시스템
   - `team-lead-prompts/`는 본인에게 없음 (팀장 vault)
   - 팀원 간 충돌 방지 (분담대로)
   - PR 흐름 (작은 PR·매일 main rebase)
   - 머지 권한은 팀장만

3. **`docs/TEAM-WARNINGS.md`** — 주의사항 모음
   - 절대 X: main 직접 push, `.env.local` commit, 운영 DB 마이그 적용
   - 본인 분담 외 영역 수정 시 팀장 합의
   - 매칭 엔진·정산·RLS·Firestore Rules = `core` 라벨 사전 합의
   - 시크릿 의심 시 즉시 멈춤
   - PR 300줄 이하 권장
   - 자주 main rebase

4. **각 팀원별 맞춤 멘트 2개** (팀원 1·팀원 2 분담 명시)

→ 팀원 초대 카톡 멘트는 **채팅으로만 전달(repo 미보관 정책)** — 팀원도 repo를 보므로 초대·운영 노트는 남기지 않음.
   COLLABORATION-GUIDE / TEAM-WARNINGS 내용은 `ROLES.md`·`docs/GIT-WORKFLOW.md`·`docs/TEAM-TASKS.md`·`CONTRIBUTING.md`가 커버(별도 파일 생략).

### 초대 전 사용자(팀장)가 할 일
- 팀원 GitHub collaborator 추가
- 1Password 공유 vault 접근권한 (dev 키만)
- 카톡으로 안내 멘트 전달 (위 1번)
- 팀원이 셋업 완료 알릴 때 확인

---

## ⏳ 미해결 이슈

- 없음 (기획 모든 결정 완료)

---

## ✅ 최근 완료 (Recent)

### 2026-05-28 — Foundation Phase 2 진행 (P2-1 ~ P2-4 마스터비번)
- **P2-1** 로컬 Supabase 환경: Docker·`supabase init`·`.env.local` (Supabase 로컬키 + vault Firebase/카카오/마스터키)
- **P2-2** DB 마이그 1차: 12테이블 + RLS 골격(regions·region_locations 공개읽기) + 53지구 seed + 타입생성. 로컬 검증 통과
- **P2-3** SSR 클라이언트 4종 (browser·server·middleware·admin) + 루트 세션 미들웨어
- **P2-4** 마스터 비번 인증 ✅: `/admin/login` + jose JWT 세션 24h + 5회 1h 잠금 + `/admin` 미들웨어 보호. bcrypt 호환 검증
- `feat/foundation-phase-2` 4 commit (453b6ee·a00356d·72b85bb)
- ⏳ 남음: **Google OAuth(operator)** = Cowork 외부설정 → P2-5 Firebase → P2-6 PWA  *(→ v1.1 정정: Google OAuth 폐기, CCC 로그인으로 전환)*
- ⚠️ RLS 세밀 정책(operator/passenger)은 OAuth 인증 스킴 확정 후 별도 마이그  *(→ v1.1: CCC 로그인 + 자체 세션 스킴, 앱레이어 강제)*

### 2026-05-28 — Foundation Phase 1 완료 (PR #1 squash 머지, main 2c16ad0)
- Next.js **16** + React 19 + TS strict + Tailwind **v4** + ESLint 9 + Prettier 3
- shadcn/ui (Base UI 기반) + Pretendard (dynamic-subset) + 브랜드 색상 4종 (Blue·Green·Yellow·Red, light/dark)
- SPEC §4 폴더 구조 (lib·components·supabase·tests) + 33 라우트 placeholder + not-found
- vitest 3 (+vite 6, .mts config) + GitHub Actions CI (typecheck·lint·test·build + gitleaks) + CODEOWNERS
- CI 그린 통과 (verify + secret scan). 5 commit → squash 머지
- ⚠️ **버전 메모**: SPEC "Next.js 16" → **16** 갱신 필요 (출시 일정도 7월보다 앞당겨짐 반영)
- ⚠️ **Vercel**: 임시 랜딩(정적) 설정이라 Next 앱 preview 배포 fail — 카카오 승인 후 main production 전환 시 Next.js 재설정 필요

### 2026-05-28 — 외부 셋업 5/5: 마스터 비번 + bcrypt hash (CC, vault 보관)
- 24자 랜덤 비번 (`openssl rand -base64 18`) + bcrypt **cost 12** hash
- round-trip `checkpw` 검증 OK
- `_secrets/setup-5-master-password.md` (chmod 600, gitignored) — 1Password 대신 vault 보관 (사용자 선택)
- hash → Vercel env `MASTER_PASSWORD_HASH` (Foundation Phase 2 / setup-4 2차에 입력 예정)
- 카카오 블로커 대기 중 선(先)처리 (카카오 무관 작업)

### 2026-05-28 — 카카오 비즈니스 정보 심사 신청 (재신청)
- 신청 폼 입력:
  - 카테고리: 자동차/교통수단 (자동)
  - 운영 중인 웹사이트 URL: **`https://bus-cignal.vercel.app`**
  - 서비스 화면 첨부: `bus-cignal-overview.pdf` (OVERVIEW.md를 CC가 PDF 변환, 18개 섹션)
  - 추가 정보: 서비스 설명 + 카카오맵 사용 목적 + 랜딩 페이지 URL + PDF 안내 명시
- 신청 결과: **● 심사 중** (영업일 3~5일 대기, 카카오 메일로 결과 통지)
- 카카오 메일 = 팀장 카카오 계정 등록 메일 = `kd100150@gmail.com` 추정
- 승인 시 다음 작업: 카카오맵 추가 기능 신청 → 카카오 승인 대기 (별도 1~2일)

### 2026-05-28 — 외부 셋업 4/5 부분: Vercel 임시 랜딩 페이지 배포 완료
- Vercel Project: **bus-cignal** (lumiere001's projects · Hobby plan)
- 대시보드: https://vercel.com/lumiere001s-projects/bus-cignal
- **Production 배포 도메인: `https://bus-cignal.vercel.app`** ✓ (카카오 JS SDK 도메인 등록과 일치 — 추가 등록 불필요)
- Production Branch: `temp/landing-for-kakao` (main이 아닌 임시 브랜치, Foundation 진입 전까지 유지)
- Framework: Other (정적 HTML, vercel.json buildCommand:null)
- Env Vars: 비어 있음 (Foundation Phase 2에서 입력)
- 랜딩 콘텐츠: Bus Cignal 서비스명·CCC 운영 주체·2026년 7월 출시 예정·핵심 기능·비영리 운영·개인정보 처리 원칙 명시
- viewport meta 태그 OK (모바일 대응)
- 다음 즉시 작업: 카카오 비즈니스 정보 심사 재신청 (URL + OVERVIEW.md PDF 첨부)
- 추후 작업: Foundation Phase 2 진입 시 정식 Vercel 셋업 (Next.js 빌드 + env vars + production branch = main)

### 2026-05-28 — 외부 셋업 3/5 진행 중: 카카오 앱·키·도메인·비즈 앱 전환 완료, 비즈니스 정보 심사 대기
- App: **Bus Cignal** (App ID: **1470045**, 카테고리: 자동차/교통수단, 회사명: CCC IT 사역부)
- 키 확보 (1Password 또는 vault 저장):
  - **JavaScript 키**: `(1Password 참조)` → `NEXT_PUBLIC_KAKAO_MAP_API_KEY`
  - **REST API 키**: `(1Password 참조 — git 평문 금지)` → `KAKAO_REST_API_KEY`  ⚠️ 과거 커밋에 평문 노출됨 → rotation 권장
- JavaScript SDK 도메인 등록 (Default JS Key):
  - `http://localhost:3000`
  - `https://bus-cignal.vercel.app` (Vercel 도메인 확정 후 재확인)
- 앱 아이콘 업로드 ✓ (GPT/Gemini로 생성)
- **개인 개발자 비즈 앱 전환 완료** ✓ (전화번호 본인인증 + 카카오비즈니스 통합 서비스 약관 동의, 전환 목적: "직접 입력" + 카카오맵 사용 명시)
- **신청 자격 확인 완료** ✓ (2026.05.28)
- ⚠️ **카카오 정책 변경 발견** (2025년 12월 ~ 2026년 3월 사이):
  - 카카오맵 사용 = 비즈 앱 전환 필수 (이전엔 단순 토글)
  - 비즈 앱 전환은 사업자 등록 안 해도 가능 (개인 전화번호 본인인증 OK)
  - 신의 악단(앱 1442060) 같은 옛 앱은 이전 정책 그대로 작동, 신규 앱은 새 정책 적용
- 🚧 **막힌 지점**: 카카오 "비즈니스 정보 심사" 신청에 **실제 운영 중인 웹사이트 URL 필수**. Bus Cignal은 아직 출시 전이라 URL 없음.
- ⏳ 남은 작업 (Vercel 셋업 후 가능):
  - 비즈니스 정보 심사 신청 (URL = Vercel 임시 랜딩 페이지)
  - 카카오맵 권한 신청 (비즈니스 정보 심사 통과 후)
  - 카카오 측 승인 대기 (통상 1~2일)
- 다음 작업: 외부 셋업 4/5 Vercel + 임시 랜딩 페이지 배포 → 카카오 재신청

### 2026-05-28 — 외부 셋업 2/5: Firebase 프로젝트 생성
- Project ID: **`bus-cignal`** (Spark 무료, Number: 745247736840)
- Firestore (default DB): **`asia-northeast3` (Seoul)** ✓ — 프로덕션 모드 (모든 R/W 차단, Security Rules는 마이그에서 작성)
- FCM API V1: 사용 설정됨 ✓
- Web 앱 등록: nickname `bus-cignal-web` (Hosting 미설정)
- Google Analytics: 비활성화 ✓ / Firebase Gemini AI: 비활성화 ✓
- 자격증명 (1Password 또는 vault 저장 필요):
  - **firebaseConfig** (6키, NEXT_PUBLIC_* 클라이언트 expose)
    - apiKey, authDomain (bus-cignal.firebaseapp.com), projectId (bus-cignal),
      storageBucket (bus-cignal.firebasestorage.app), messagingSenderId (745247736840),
      appId (1:745247736840:web:9ba7e7a1787de06642fdbd)
  - **VAPID public key** (Web 푸시용, 공개 — 클라이언트 expose OK)
  - **Admin SDK JSON** ★★★ (~/Downloads/bus-cignal-firebase-adminsdk-*.json)
    - 서비스 계정: firebase-adminsdk-fbsvc@bus-cignal.iam.gserviceaccount.com
    - 최상위 권한 (Security Rules 우회 가능) — 즉시 안전 위치 이동 필수
- 다음 작업: 외부 셋업 3/5 카카오 개발자센터

### 2026-05-27 — 외부 셋업 1/5: Supabase 프로젝트 생성
- Organization: **CCC IT 사역부** (Free plan, 신규 생성) — 기존 ai-agent-hub org 영구 삭제
- Project: **bus-cignal-prod** (Free plan)
- Region: **Northeast Asia (Seoul) ap-northeast-2** ✓
- Project Ref ID: `zovrgrbrzxpzmgpkxmns`
- Project URL: `https://zovrgrbrzxpzmgpkxmns.supabase.co`
- Status: Healthy
- Security:
  - Enable Data API ✓ (기본)
  - Automatically expose new tables ✓ (기본, RLS로 통제)
  - Enable automatic RLS ✗ (마이그에서 명시적 RLS 작성)
- 자격증명 (1Password "Supabase · bus-cignal-prod" 단일 item에 저장):
  - DB password
  - anon (legacy JWT) + service_role (legacy JWT) ★
  - publishable key (sb_publishable_*) + secret key (sb_secret_*) ★
- 운영 인스턴스 — 코드 작업 전까지 손대지 말 것 (로컬 dev DB는 Docker로)
- 다음: 외부 셋업 2/5 Firebase

### 2026-05-27 23:00 — v1.0 Confirmed Final + 도구 분담·세션 시스템
- SPEC v1.0 Confirmed Final 최종본 (vault README + repo docs/SPEC.md)
- OVERVIEW 디테일 보강 (팀·간사 스팩 파악용, 18개 섹션)
- 로컬 Supabase 셋업 가이드 ONBOARDING에 추가 (Docker)
- `docs/AI-PROMPTS/setup-1~5-*.md` 5개 + setup-README 작성
- WORKLOG·SESSION-HANDOFF 다음 세션 인계 정보 명시
- 모든 결정 사항 반영:
  - 마스터 = 비번 only
  - 간사 가입 시 location 등록 → 출발지 미지정 패널티 제거
  - 부분 매칭 = 우선순위 자동  *(→ v1.1 정정: 간사 수동 선택, priority=힌트)*
  - K2 자리 풀릴 때마다 알림
  - 학생 자의 취소 + "환불 각 지구 문의"
  - PWA V1 도입 (옵션 C)
  - 티켓 BUS-XXXX
  - 익명화 매일 새벽 3시
  - 도구 분담 + 세션 손실 방지

### 2026-05-27 17:00 — v1.0 Confirmed (1차)
- 17개 안건 결정, 우선순위 매칭 도입
- "East_Star" → "팀장" 일괄 교체

### 2026-05-26 — 기획 초안 ~ v0.3
- v0.1 → v0.2 부분 매칭 학생 선택 → v0.3 슬라이스 실시간
- 팀원 기획안(이유성·김도영) 검토 후 본 안 채택
- GitHub repo `Lumiere001/bus-cignal` (private) 생성
- 팀원 문서 트리오 (CLAUDE·AGENTS·ONBOARDING·CONTRIBUTING·COWORK)

---

## 🛠 AI 자동 갱신 규칙

### 작업 시작 시 (사용자 의도 감지)
사용자가 "작업 시작", "이어서", "다시" 같은 의도 표하면 AI 자동:
1. `git fetch origin main`
2. `git log HEAD..origin/main --oneline`
3. `cat CHANGELOG.md | head -50` — Unreleased 섹션
4. `cat WORKLOG.md` ← **이 파일**
5. `cat docs/SESSION-HANDOFF.md` ← 인계 정보
6. SPEC.md / CLAUDE.md diff 분석
7. 본인 작업 영역 영향 평가
8. **사용자에게 어디서 끊겼는지 + 다음 액션 한 줄 보고**

### 작업 종료 시 (사용자 의도 감지)
사용자가 "끝내자", "Cowork으로", "다음에" 같은 의도 표하면 AI 자동:
1. 이 파일 `🔄 현재 작업` 섹션 갱신
2. 완료된 것 → `✅ 최근 완료`
3. 미해결 → `⏳ 미해결 이슈`
4. 도구 전환이면 → `docs/SESSION-HANDOFF.md` 자동 작성 + 복사용 프롬프트 제공
