-- Bus Cignal — 버스 미배정 대기큐 (region wait queue). 스펙 v1 (사용자 확정 2026-06-12).
-- 공급 지구가 버스(trip)를 안 올리면 수요측(타지구 간사·학생)은 신청 자체가 불가했다.
-- → trip 없이도 "그 지구 대기큐"에 신청을 걸어두고, 버스가 생기면 공급 간사가 수동으로
--   trip에 배정(update trip_id)하는 흐름을 추가한다.
--
-- 미배정 구분 = trip_id IS NULL (status는 기존 'queued' 재사용 — 상태머신 무변경).
-- 배정 = update seat_requests set trip_id = $trip 한 번. wait_* 컬럼은 이력으로 보존.

-- 1) trip 없이도 신청 존재 가능
alter table seat_requests alter column trip_id drop not null;

-- 2) 대기 신청 정보 (trip_id null일 때 필수, 배정 후에는 이력으로 남김)
alter table seat_requests add column wait_region_id uuid references regions (id);
alter table seat_requests add column wait_direction text
  check (wait_direction in ('up', 'down'));      -- 가는편(up)/오는편(down)
alter table seat_requests add column wait_desired_date date;  -- 희망 출발일(선택)

-- 3) trip 또는 대기 정보 중 하나는 반드시.
-- 기존 행: trip_id not null(과거 제약) → 충족.
alter table seat_requests add constraint seat_requests_trip_or_wait_chk
  check (trip_id is not null or (wait_region_id is not null and wait_direction is not null));

-- 4) 공급측 대기큐 조회 인덱스 — wait-queue 페이지의 "내 지구 미배정 queued 시간순" 쿼리 전용
create index idx_seat_requests_wait_queue
  on seat_requests (wait_region_id, status, requested_at) where trip_id is null;

comment on column seat_requests.wait_region_id is
  '버스 미배정 대기큐 대상(공급) 지구. trip 배정 후에도 이력으로 보존';
comment on column seat_requests.wait_direction is
  '대기 신청 방향 — up(가는편)/down(오는편). trip 배정 후에도 이력으로 보존';
comment on column seat_requests.wait_desired_date is
  '대기 신청 희망 출발일(선택). 공급 간사의 배정 참고용';
