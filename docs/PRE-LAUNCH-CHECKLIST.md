# 출시 전 체크리스트 (Pre-Launch)

> 기능을 다 만들어도 **출시(학생·간사 실사용) 전에 반드시 확인**할 시스템 차원 항목.
> 2026-06-03 코드 리뷰(알림엔진·학생세션·매칭엔진) 중 도출. 항목 해소되면 체크.

---

## 🔴 보안

- [ ] **RLS 실제 적용** (SPEC §8) — 현재 거의 모든 DB 접근이 `createAdminClient()`(service_role)로 RLS를 **우회**하고 접근 제어를 앱 코드로만 함. 출시 전 DB 레벨 RLS(간사=본인 지구, 학생=본인 매칭만) 적용해 **타지구 명단 유출을 DB에서 차단**.
- [ ] **CCC 인증 본구현** — `verifyCccToken` → `/login` 연동 → 미들웨어 `/operator` 가드. (CCC IT 전달방식 답 대기)
- [ ] **세션 시크릿 가드 일관성** — `passenger`엔 "키 없으면 throw" 적용됨(#12). `master`·`operator` 세션도 동일 가드 적용(현재 `!` 무방비).
- [x] Vercel `MASTER_PASSWORD_HASH` 라이브 검증 완료 (2026-06-01)

## 🟡 핵심 흐름 완성·검증

- [ ] **offer 생성 흐름** — "타지구 공개 토글 → `seat_offers`(open)" 구현. 매칭 `available()`이 offer에 의존하므로 필수. (팀원1 차량등록 #2와 함께)
- [ ] **예약번호(BUS-XXXX) 생성** — paid 시점 발급 + DB unique + 충돌 재생성 (SPEC §7 티켓 규칙). 현재 미구현.
- [ ] **알림 트리거 wiring** — 알림 엔진(`lib/notifications`)은 있으나 `emit()` 호출이 cron 외 없음. 승인·거절·취소·송금·D-1 흐름에 호출 삽입 (팀원1·2).
- [ ] **E2E 통합 테스트** (SPEC: V1 필수) — S1(매칭)·S4(송금)·S5(학생) 전체 사슬: 차량등록→공개→신청→승인→매칭→송금→예약번호. 현재 단위 테스트만 있고 끝-끝 미검증.

## 🟡 코드 품질·정합성

- [ ] **도메인 타입 단일 출처** — 매칭 엔진이 `Trip`·`Match`·`SeatRequest`를 손으로 재정의(`lib/matching/types.ts`)해 생성 타입(`database.types.ts`)과 어긋남(PR #13 `RequestStatus` 버그가 그 증상). 생성 타입에서 **파생**하도록 통일 + "DB 타입 단일 출처" 컨벤션. → SPEC/스키마 status 값과 코드 타입 불일치 방지.

## 🟡 배포(Vercel) env

- [ ] **`PASSENGER_SESSION_SECRET` 추가** (Production, Sensitive) — 없으면 `/r` 제출 시 런타임 throw(학생 로그인 깨짐). 학생 화면 배포 전 필수.
- [ ] CCC 검증 키/URL (방식 확정 후 추가, 예: `CCC_TOKEN_PUBLIC_KEY` / `CCC_VERIFY_URL`)

## 🟢 데이터·운영

- [ ] **`anonymize_after` 설정** — `system_config`에 수련회 종료 + 90일 날짜. 안 넣으면 익명화 cron이 skip (SPEC §10.3).
- [ ] **PWA 푸시 백엔드** — `push_subscriptions` 마이그 + FCM 실발송 (푸시 알림 쓸 경우). 현재 인앱만, 푸시는 stub.

---

## 재검토
각 PR 머지·기능 완성 때마다 해당 항목 체크. 출시 직전 이 문서 전체 1회 통독.
