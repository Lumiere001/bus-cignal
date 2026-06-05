-- B3: 좌석 over-booking·이중매칭 동시성(race) 방지.
-- 결정: docs/decisions/2026-06-05-atomic-approve-request.md
--
-- 문제: app의 approveRequest가 (잔여 계산) → (검증) → (matches insert)을 락 없이 수행.
--   두 간사/두 탭이 동시에 승인하면 같은 잔여를 읽고 둘 다 통과 → 정원 초과 매칭(돈 직결).
--   같은 신청을 중복 승인하면 한 학생에 활성 매칭 2건 → 정산 2배.
--
-- 처방:
--  (1) 활성 매칭 "1인 1건" 부분 unique 인덱스 — 같은 학생 활성 매칭 중복을 DB가 차단(백스톱).
--  (2) approve_request_atomic() — seat_offers 행을 FOR UPDATE로 잠가 동시 승인을 직렬화하고,
--      잠금 안에서 잔여를 재계산해 over-capacity를 거부한 뒤 matches를 원자적으로 삽입.

-- (1) 활성 매칭 1인 1건 (이중 매칭 차단). expired/cancelled는 비활성이라 제외 → 재신청 가능.
create unique index if not exists matches_active_passenger_uniq
  on matches (passenger_id)
  where status in ('awaiting_payment', 'payment_reported', 'paid');

-- (2) 원자적 승인 — 좌석 잠금 + 잔여 재검증 + 매칭 삽입 + 신청 상태 갱신.
--     실패 시 RAISE EXCEPTION(메시지 코드) → 앱이 사용자 메시지로 매핑.
--     ※ 지구 소유권(operator_region_id) 가드는 앱 레이어(loadOwnedTrip)에서 선검증.
create or replace function approve_request_atomic(
  p_trip_id uuid,
  p_request_id uuid,
  p_passenger_ids uuid[],
  p_payment_due_at timestamptz
) returns uuid[]
language plpgsql
as $$
declare
  v_selected int := coalesce(array_length(p_passenger_ids, 1), 0);
  v_open_seats int;
  v_active int;
  v_available int;
  v_total int;
  v_matched int;
  v_match_ids uuid[];
begin
  if v_selected = 0 then
    raise exception 'NO_PASSENGERS';
  end if;

  -- 이 trip의 공개 좌석 행을 잠가 동시 승인 직렬화 (없으면 잠글 행이 없어 통과 → 아래 상태검증이 거름)
  perform 1 from seat_offers where trip_id = p_trip_id and status = 'open' for update;

  if not exists (select 1 from trips where id = p_trip_id and status = 'published') then
    raise exception 'TRIP_NOT_PUBLISHED';
  end if;

  if not exists (
    select 1 from seat_requests
    where id = p_request_id and trip_id = p_trip_id and status = 'queued'
  ) then
    raise exception 'REQUEST_NOT_QUEUED';
  end if;

  -- 선택 학생이 모두 이 신청 소속인지
  if (
    select count(*) from request_passengers
    where id = any(p_passenger_ids) and request_id = p_request_id
  ) <> v_selected then
    raise exception 'PASSENGER_MISMATCH';
  end if;

  -- 이미 활성 매칭된 학생 포함 여부 (중복 매칭 차단)
  if exists (
    select 1 from matches
    where passenger_id = any(p_passenger_ids)
      and status in ('awaiting_payment', 'payment_reported', 'paid')
  ) then
    raise exception 'ALREADY_MATCHED';
  end if;

  -- 잔여 좌석 재계산 (잠금 안에서) = 공개 좌석 합 - 활성 매칭 수
  select coalesce(sum(seat_count), 0) into v_open_seats
    from seat_offers where trip_id = p_trip_id and status = 'open';
  select count(*) into v_active
    from matches
    where trip_id = p_trip_id
      and status in ('awaiting_payment', 'payment_reported', 'paid');
  v_available := v_open_seats - v_active;

  if v_selected > v_available then
    raise exception 'OVER_CAPACITY';
  end if;

  -- 매칭 원자적 삽입
  with ins as (
    insert into matches (trip_id, request_id, passenger_id, status, payment_due_at)
    select p_trip_id, p_request_id, pid, 'awaiting_payment', p_payment_due_at
    from unnest(p_passenger_ids) as pid
    returning id
  )
  select array_agg(id) into v_match_ids from ins;

  -- 신청 전원이 매칭됐으면 status='matched' (부분 선택이면 queued 잔류)
  select count(*) into v_total from request_passengers where request_id = p_request_id;
  select count(*) into v_matched
    from matches
    where request_id = p_request_id
      and status in ('awaiting_payment', 'payment_reported', 'paid');
  if v_matched >= v_total then
    update seat_requests set status = 'matched' where id = p_request_id;
  end if;

  return v_match_ids;
end;
$$;
