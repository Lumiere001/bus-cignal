# Bus Cignal — 팀원 첫 작업 (v1.1)

> 누가 무엇을 먼저 하는지. `ONBOARDING.md`로 셋업을 끝낸 뒤 본인 섹션부터 시작하세요.
> 기획 정본 = `docs/SPEC.md` (v1.1), 요약 = `docs/OVERVIEW.md`. 역할·권한 = `ROLES.md`.

---

## 0. 시작 전 (공통)

- [ ] `ONBOARDING.md` 셋업 완료 — clone · `supabase start` · `.env.local` · `pnpm dev` · 게이트 4종 통과
- [ ] `.team-role` 설정 (`team-member-1-operator` 또는 `team-member-2-passenger`)
- [ ] `docs/OVERVIEW.md`(v1.1) 통독 + `docs/SPEC.md` **본인 영역** 정독
- [ ] **작은 PR** 원칙 (100줄 PR 여러 개 > 큰 PR 1개). 머지는 팀장 approve.

### ⚠️ v1.1 핵심 (꼭 알고 시작)
- 간사 인증 = **CCC 로그인** (Google OAuth 아님 — 아직 연동 대기, 아래 블로커)
- 매칭 = **시각순 정렬 + 간사 수동 선택** (FIFO 강제·자동 부분매칭 **없음**). `priority`는 힌트.
- 송금 = **자동 만료 없음** (소프트 리마인더 + 간사 수동 [자리 풀기])
- 학생·간사 PWA = **옵트인** (조회는 항상, 푸시는 선택)

---

## 1. 분담 경계 (충돌 방지)

| | 영역 |
|---|---|
| **팀원1 (운영자·마스터)** | `app/operator/*` · `app/admin/*` · `lib/matching/*` · `lib/admin/*`(신설) · `lib/settlement/*` · `components/operator|admin/*` |
| **팀원2 (학생·채팅)** | `app/me/*` · `app/r/*` · `app/chat/*` · `lib/firebase/*` · `lib/kakao/*` · `lib/passenger/*`(신설) · `components/me|chat/*` |
| **팀장/CC (Foundation·인프라)** | CCC 인증·세션·미들웨어 · `lib/notifications/*`(알림 엔진 18이벤트) · cron(리마인더·익명화) · PWA infra(manifest·sw·FCM 등록) · seed·dev로그인 우회 |
| **공유 (변경 시 팀장+상대 합의)** | `lib/supabase/*`(types·client) · `supabase/migrations/*` · `lib/validators/*` · `lib/labels.ts`(신설) · `app/page.tsx` · `components/ui/*` |

> 🔴 DB 마이그·RLS·매칭 엔진·정산 변경 = `core` 라벨 + 팀장 명시 합의 (ROLES §5).

---

## 2. 팀원 1 — 운영자·마스터 UI

참조: SPEC §2.2 · §5.4~5.6 · §5.9~5.11 · **§7(매칭 방식)** · §8

| # | 작업 | SPEC | 비고 |
|---|---|---|---|
| 1 | (워밍업) `lib/labels.ts` — Trip/매칭 상태·방향(상행/하행)·라벨 헬퍼 | §6 | **공유 파일** — 팀장 합의 후. 둘 다 씀 |
| 2 | `/operator/trips` 목록 + `/operator/trips/new` 생성 폼 (등록 location 드롭다운, 자유입력 X) | §5.4 | DB `trips`·`region_locations` |
| 3 | `lib/matching/` 순수 함수 `queue()`·`available()`·`approve(request, selectedIds)` + Vitest 90%+ | §7 | **v1.1 수동** — FIFO 강제·자동 분할 없음 |
| 4 | `/operator/trips/:id` 매칭 큐 UI (시각순 정렬 + 학생 선택 체크 + 승인 모달) | §5.5 | |
| 5 | `/operator/requests` + `/operator/requests/new` (학생 명단 + 우선순위 힌트 + 동의 체크) | §5.6 | |
| 6 | `/operator/settlement` 받을돈/보낼돈 표 + CSV | §7(S7) | 본인 지구만 |
| 7 | 마스터: `/admin` · `/admin/operators(+/pending)` · `/admin/settlement` | §5.9~5.11 | |

- **지금 바로 가능**: 2·3은 CCC 인증과 무관 — DB·스키마 준비됨. 매칭 엔진(3)부터 잡으면 좋음.
- **인증 우회(dev)**: CCC 로그인 미구현 → 화면 렌더링용 임시 dev 세션 헬퍼는 **팀장이 곧 제공**. 그 전엔 컴포넌트·`lib/matching`·단위테스트부터.

---

## 3. 팀원 2 — 학생·채팅

참조: SPEC §2.3 · §3(S5·S5a·S6) · §5.7·5.8 · §9.2·9.3

| # | 작업 | SPEC | 비고 |
|---|---|---|---|
| 1 | `/r/:code` 학생 진입 (이름 + 전화 끝 4자리 검증 → 세션 30일) | §3.S5 | `match_passengers.access_token_hash` 검증 |
| 2 | `/me` 다중 매칭 카드 (노선·시간·요금·예약번호·[지도][채팅][취소]) | §5.7 | 출발 시각 가까운 순 |
| 3 | `/me/cancel/:matchId` 학생 자의 취소 (환불 문의 안내, D-1 강안내) | §5.8 | 양쪽 간사 알림 |
| 4 | 카카오맵 임베드 컴포넌트 `lib/kakao/` (출발지 좌표 → 지도) | §9.4 | 본인 카카오 앱 JS 키 (팀원2 등록·제공) |
| 5 | **PWA 옵트인 흐름** — `/me` 부드러운 배너 → 홈화면추가/알림허용 안내 (iOS/Android 분기) | §9.3 | 조회는 설치 없이 항상 |
| 6 | Firebase 채팅 `lib/firebase/` (Firestore onSnapshot, 세션→Custom Token, `/chat/:tripId`) | §9.2·§3.S6 | |

- **지금 바로 가능**: 1·2·3은 Supabase만으로 개발 가능.
- **블로커**:
  - Firebase Admin 키(Custom Token) = 팀장 1Password(dev). 받기 전엔 채팅(6) UI는 mock으로 선개발.
  - 카카오맵 키 = **팀원2가 본인 카카오 개발자 계정으로 앱 등록·제공** (팀장 비즈 주체 충돌 예외). 기본 지도는 JS 키로 가능, 고급(좌표 등)은 심사 대기.

---

## 4. Definition of Done (PR 머지 조건)

- [ ] 게이트 4종 통과 (`pnpm typecheck` · `lint` · `test` · `build`)
- [ ] 본인 코드 단위 테스트 (매칭·정산·검증은 특히)
- [ ] PR 본문에 관련 SPEC 섹션 참조
- [ ] 팀장 approve → 팀장 머지

---

## 5. 막혀있는 것 (팀 공통)

| 블로커 | 영향 | 해소 |
|---|---|---|
| CCC 로그인 신원 전달 방식 | 간사 인증 본구현 (팀원1 화면 authed 렌더) | 간사님(CCC IT) 답 → 팀장이 `verifyCccToken` 구현 |
| Firebase Admin dev 키 | 팀원2 채팅 Custom Token | 팀장 1Password 공유 |
| 카카오맵 고급 기능 심사 | 좌표 등 고급 | 비즈 심사 + 교수님 합의 (팀장) |

> 블로커는 "선개발 가능한 부분부터" 진행하면 대기 시간 없이 굴러갑니다.
