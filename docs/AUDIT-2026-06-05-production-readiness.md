# Bus Cignal — 출시 준비도 감사 (2026-06-05)

> CC 6-도메인 병렬 코드 감사 + 로컬 4-게이트(typecheck·lint·test·build) + Docker DB 검증 종합.
> 기획(`docs/SPEC.md`) 대비 구현 완성도·실사용 가능성 점검.

## 종합 판정: **조건부 GO — 코어는 견고, 출시 블로커 잔존**

- ✅ **4 게이트 전부 PASS**: typecheck·lint·test(**165/23파일**)·build. (경고 1건: Next 16 `middleware`→`proxy` deprecation, 비차단)
- ✅ **타입↔스키마 정합** 드리프트 0 · **env** `process.env` 21개 전부 `.env.example` 존재 · **마이그 정렬·무결성** 정상
- ✅ **코어 실구현**: operator 체인(등록→정산) · admin 11페이지 · passenger 코어 · 알림 엔진 코어
- ❌ 단, 아래 🔴 블로커 해소 전 **실사용 금지**. 특히 **prod에서 간사 로그인 경로가 0**(CCC 미구현 + dev-login은 prod 차단)이라 현재로선 시스템이 작동하지 않음.

---

## 🔴 출시 블로커

| # | 항목 | 영역 | 처방 |
|---|---|---|---|
| **B1** | **CCC 간사 인증 미구현** — `lib/auth/ccc.ts:verifyCccToken` throw + `app/login` placeholder. prod에서 간사 로그인 경로 0 (dev-login은 prod 차단) | 팀장 **(외부 대기)** | CCC IT 신원 전달방식 확정 → `verifyCccToken` 구현 → `/login` 연동. 유일 외부 블로커 |
| **B2** | ~~anonymize cron `created_at < cutoff` 필터 누락~~ → 전역 게이트 후 전체 PII 무차별 스크럽 (PIPA 위반) | 팀장(cron) | ✅ **이 PR에서 수정** (`.lt("created_at", cfg.value)` 3쿼리) |
| **B3** | **좌석 over-booking race** — 승인 경로(`approveRequest`) read-then-write, DB 락/트랜잭션 없음. 동시 승인 시 정원 초과 매칭(돈 직결) | core(팀장 리뷰)+팀원1 | `matches` partial unique index(passenger active) + 승인을 단일 트랜잭션/`FOR UPDATE`로. R2(이중매칭)도 동시 해소 |
| **B4** | **`/privacy`·`/terms` 빈 placeholder** — PII 수집 앱 PIPA 필수 | 콘텐츠 | 실제 처리방침·약관 내용 |
| **B5** | ~~마스터 잠금 카운터 리셋 버그~~ → 1회 잠금 후 자기-DoS(운영자 영구 잠금 위험) | 팀장(auth) | ✅ **이 PR에서 수정** (잠금 만료 시 attempts·lock_until 리셋) |
| **B6** | Vercel Production `PASSENGER_SESSION_SECRET` 주입 (없으면 `/r` 학생 제출 런타임 throw) | 운영 설정 | Cowork/팀장 |
| **B7** | 신규 마이그 `20260605000002_rls_hardening_revoke` 원격 적용 (PR #56 머지 후) | 팀장 게이트 | 기존 5/5는 그대로, 새 마이그 1개만 |

---

## 🟠 출시 전 강력 권장

| 항목 | 영역 | 비고 |
|---|---|---|
| 학생 본인확인 **rate-limit 없음** | passenger+팀장 | 예약번호 노출 시 이름+전화끝4 무제한 대입 → 타인 PII 열람·오취소. 마스터/간사는 5회잠금 있으나 학생만 누락 |
| **이중매칭 가드 stale-read** | core | `matches`에 partial unique index 부재 → 같은 학생 2회 insert 가능(정산 2배). B3과 묶어 처리 |
| 매칭/정산 **region 스코핑 JS레이어만** | 팀원1+RLS | service_role 전국조회 후 JS필터 — 필터 누락 시 타지구 PII 서버 유입(PIPA). 코드 주석도 인지 |
| **revoke 후 operator 세션 12h JWT 잔존** | operator-auth | §5.10 "즉시 회수" 미충족. `requireOperator`에 `approval_status` DB 재확인 추가 |
| **출발 리마인더 D-1/D-1h + `trip_changed` 미발화** | 팀장/아키텍처 | Hobby **2-cron 포화**(payment-reminder·anonymize)라 추가 cron 불가 → **Vercel Pro 또는 외부 스케줄러 결정 필요** |
| **부분매칭 통지 누락** | 팀원1 | 부분 매칭 시 양쪽이 "일부만 됐다" 모름 |
| **`/chat` 미구현인데 `MatchCard` 채팅버튼 살아있음 → 404** | 팀원2 | 출시 전 숨김/비활성 (깨진 링크) |
| **취소화면 출발시각 TZ 버그** | 팀원2 | `CancelConfirmForm.formatDeparture` 서버 로컬TZ → Vercel UTC 9h 오차(회귀). `formatKstDateShort`로 교체 |

---

## 🟡 후속 (출시 후)

- DB레벨 지구별 RLS (옵션 B — `docs/decisions/2026-06-05-rls-deny-default-boundary.md`)
- Trip 수정(G2)·`published→closed` 전이(G1) 미구현 (운영 편의, 코어 무결성 영향 없음)
- E2E playwright 전체 사슬 (현재 단위 165개만)
- anonymize 확장: `notifications.payload` PII 스크럽 + `push_subscriptions`(기기토큰) 정리
- PWA: ~~아이콘 192/512~~(✅ 이 PR) · offline(next-pwa, 2-SW 공존·캐시전략 리스크) · maskable 안전영역 PNG · apple-touch-icon
- 잡채무: `lib/matching/types` DB 파생, cron `timingSafeEqual`, settlement cellKey 구분자 통일, `middleware`→`proxy`(Next16), 푸시 딥링크 세분화

---

## ✅ 검증 통과 / 완성 (근거)

- **operator 체인 end-to-end**: 등록(위조 방지 location 대조)→공개(원자적 draft→published)→신청(priority 서버 재부여)→매칭큐(시각순·수동·강제아님)→승인(부분 잔류)→송금→입금확인(원자적 +예약번호 BUS-XXXX +match_passengers)→자리풀기→매칭취소(paid 차단)→정산(받을/보낼·CSV). 상태전이 SPEC §7 일치.
- **admin 11페이지 전부 실구현**(placeholder 0): 대시보드·operators·pending·rejections·settlement(N×N 매트릭스 수학 정확·15테스트)·system·trips·matches·regions. 마스터 다층방어(middleware + 액션마다 `verifyMasterSession`)·이중처리 가드 정확.
- **passenger 코어**: `/r` 코드 내장 진입·본인확인(이름+전화끝4)·30일세션·다중매칭(출발순)·탑승지/간사·총무 연락처카드·카카오맵(지오코딩 핀·graceful fallback)·취소→양쪽간사 알림·푸시옵트인배너(paid 시점). 48테스트.
- **알림 엔진**: 타입안전 `emit()` fanout(양쪽간사·학생·마스터)·인앱+푸시·재시도 백오프 상태머신·무효토큰 정리·cron `CRON_SECRET` 인증. **18 이벤트 중 8개 실연결**, 6개 미연결(partial_match·depart×2·trip_changed·reapply_recommended·chat_message).
- **RLS 하드닝** `20260605000002` Docker `db reset` 검증: `anon→match_passengers=false`·`authenticated→operators=false`·`anon→regions=true` (의도대로 PII 차단 + 공개읽기 유지).
- **vercel.json**: cron 2개 — payment-reminder(09:00 KST)·anonymize(03:00 KST). Hobby 2개 한도 정확히 채움(= 출발 리마인더 갭의 근본 원인). push-retry는 payment-reminder piggyback.

---

## 도메인별 판정

| 도메인 | 판정 | 핵심 잔여 |
|---|---|---|
| 인증·보안 | 조건부 | B1 CCC · B5(✅수정) · 학생 rate-limit |
| operator 흐름 | 조건부 | **B3 좌석 race(블로커)** · 부분매칭 통지 |
| passenger 흐름 | 조건부 | 취소 TZ버그 · /chat 깨진링크 |
| admin/master | 조건부 | revoke 세션 즉시종료(§5.10) |
| 알림·cron | 조건부 | B2(✅수정) · 출발 리마인더(Pro 결정) |
| 스키마·빌드 | **GO** | 게이트 클린 |

---

## 이 PR(`fix/prelaunch-fixes`)에서 처리한 항목

- ✅ **B2** anonymize cron `created_at < cutoff` 필터 (PIPA correctness)
- ✅ **B5** 마스터 잠금 만료 후 카운터 리셋 (자기-DoS 방지)
- ✅ **PWA 아이콘** 192·512 PNG 생성 + manifest 연결

별도: **PR #56** = RLS 하드닝 마이그 + 결정문. anonymize_after 값(수련회 종료 2026-07-01 +90일 = **2026-09-29**)은 prod 세팅 방법 협의 대기.
