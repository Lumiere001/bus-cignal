# 좌석 over-booking·이중매칭 race 방지 — 원자적 승인 (결정)

- **일자**: 2026-06-05
- **결정자**: 팀장(East_Star) — 전체 코드베이스 감사에서 B3 블로커로 식별 후 수정
- **요약**: 간사 승인 흐름의 동시성 race(정원 초과·이중 매칭, 돈 직결)를 Postgres RPC(행 잠금) + 부분 unique 인덱스로 DB 레벨에서 닫는다.

---

## 문제 (감사 B3, 🔴)

`approveRequest`(`app/operator/trips/[id]/actions.ts`)가 **read-then-write**였다:
1. `computeAvailable()`로 잔여 좌석 읽기 →
2. 매칭 엔진으로 `selected <= available` 검증 →
3. `matches` insert.

이 사이에 DB 락/트랜잭션이 없어:
- **Over-booking**: 두 간사/두 탭이 동시에 승인하면 같은 잔여를 읽어 둘 다 통과 → 정원 초과 매칭. 정산·돈과 직결.
- **이중 매칭**: 같은 신청을 동시 승인하면 한 학생에 활성 매칭 2건 → 정산 2배. `matches`에 막을 제약이 없었음.

## 결정

1. **부분 unique 인덱스** `matches_active_passenger_uniq` — `passenger_id` where status in (active 3종). 같은 학생 활성 매칭 중복을 DB가 거부(백스톱). expired/cancelled 제외 → 재신청 가능.
2. **RPC `approve_request_atomic(trip, request, passenger_ids[], due)`** — `seat_offers` 행을 `FOR UPDATE`로 잠가 **동시 승인을 직렬화**하고, 잠금 안에서 잔여를 **재계산**해 over-capacity·이미매칭·소속불일치·상태를 검증한 뒤 `matches`를 **원자적으로 삽입**하고 신청 상태를 갱신. 실패 시 `RAISE EXCEPTION`(코드) → 앱이 사용자 메시지로 매핑.
3. 앱 `approveRequest`는 소유권 가드(`loadOwnedTrip`, 지구) 선검증 후 RPC 호출 → 알림(`match_confirmed`)·revalidate만 담당. 매칭 엔진(`lib/matching`) 의존 제거(순수함수·테스트는 유지).

## 고려한 대안

- **앱 레이어 advisory lock / 트랜잭션**: supabase-js가 다중문 트랜잭션을 깔끔히 못 해 RPC가 정석.
- **BEFORE INSERT 트리거 카운트 검증**: 동시 insert의 phantom(둘 다 카운트 통과) 문제 → 결국 행 잠금 필요. RPC가 더 명시적.
- **유니크 인덱스만**: 이중매칭은 막지만 over-booking(서로 다른 학생이 정원 초과)은 못 막음 → RPC 병행 필요.

## 검증 (로컬 Docker)

- 마이그 `20260605000004` `db reset` 적용(인덱스 seed 충돌 없음) + 타입 재생성(RPC 함수 반영). 4 게이트 PASS(typecheck·lint·test 165·build).
- RPC 실동작 3종(트랜잭션 롤백):
  - 정상 승인 1명 → match id 반환 + 활성 매칭 +1.
  - 같은 학생 재승인 → `ALREADY_MATCHED` 예외.
  - 잔여 0에서 승인 → `OVER_CAPACITY` 예외.

## 동시성 정합성

두 동시 승인이 같은 trip을 대상으로 하면 `seat_offers` 행 잠금에서 두 번째가 첫 번째 커밋까지 대기 → 첫 번째의 매칭이 반영된 잔여로 재계산 → 정원 초과 정확히 거부. 같은 학생 중복은 잠금 직렬화 + unique 인덱스로 이중 차단.

## 후속

- prod에 마이그 `20260605000004` 적용(이번 세션 자동 적용 승인).
- 입금확인(`confirmPayment`)·자리풀기 등 다른 상태 전이의 원자성은 별도 검토(현재 조건부 UPDATE로 대체로 안전, R4는 후속).

## Confidence

high (로컬 동시성 시나리오 검증, 락+제약 이중 방어)
