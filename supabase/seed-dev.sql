-- Bus Cignal — 로컬 개발 전용 테스트 데이터 (LOCAL DEV ONLY)
-- ⚠️ 운영 DB에 절대 적용 X. `supabase db reset`(로컬)에서만 자동 로드됨 (config.toml).
-- 고정 UUID + on conflict do nothing → 재실행 안전(멱등).
--
-- 만들어지는 것:
--   - 승인된 간사 2명: 김광주(광주, 공급), 박부산(부산, 수요)
--   - 광주 간사의 하행 Trip(평창→광주, 44석) + 남는 자리 10석 공개(Offer)
--   - 부산 신청 R1(2명, queued) ← 공급 간사가 매칭 큐에서 승인 테스트
--   - 부산 신청 R2(1명, matched) → 매칭 paid + 예약번호 BUS-7K9M ← 학생 /r 테스트
--
-- 사용: /dev/login 에서 간사 선택 / 학생은 /r/BUS-7K9M + 이지은 + 3444

-- 간사 (CCC 로그인 전 — ccc_id 'dev-*', 마스터 승인 완료 상태)
insert into operators (id, region_id, ccc_id, name, phone, approval_status, approved_at, role) values
  ('a0000000-0000-0000-0000-000000000001', (select id from regions where code = '2601'), 'dev-op-gwangju', '김광주', '010-1000-0001', 'approved', now(), 'operator'),
  ('a0000000-0000-0000-0000-000000000002', (select id from regions where code = '2801'), 'dev-op-busan',   '박부산', '010-2000-0002', 'approved', now(), 'operator')
on conflict (id) do nothing;

-- 출발/도착지 (광주 간사 등록)
insert into region_locations (id, region_id, direction, location_type, address, label, lat, lng, is_default, created_by) values
  ('b0000000-0000-0000-0000-000000000001', (select id from regions where code = '2601'), 'down', 'origin',      '강원 평창군 봉평면 무이리', '평창 대관령',   37.60, 128.70, true, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', (select id from regions where code = '2601'), 'down', 'destination', '광주 동구 충장로 1가',     '광주 충장로',   35.15, 126.91, true, 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000003', (select id from regions where code = '2601'), 'up',   'origin',      '광주 동구 충장로 1가',     '광주 충장로',   35.15, 126.91, true, 'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- Trip (하행 평창→광주, 44석, 35,000원) + published
insert into trips (id, operator_region_id, direction, origin_location_id, destination_location_id, departure_at, capacity, price_per_seat, note, status, created_by) values
  ('c0000000-0000-0000-0000-000000000001', (select id from regions where code = '2601'), 'down',
   'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   now() + interval '30 days', 44, 35000, '[DEV seed] 평창→광주 하행 테스트 차량', 'published', 'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- 남는 자리 공개 (10석)
insert into seat_offers (id, trip_id, seat_count, status) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 10, 'open')
on conflict (id) do nothing;

-- 신청 R1(2명, queued — 승인 대기), R2(1명, matched — 이미 매칭됨)
insert into seat_requests (id, trip_id, region_id, operator_id, seat_count, status, consent_confirmed_at, consent_confirmed_by, requested_at) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', (select id from regions where code = '2801'), 'a0000000-0000-0000-0000-000000000002', 2, 'queued',  now(), 'a0000000-0000-0000-0000-000000000002', now() - interval '2 hours'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', (select id from regions where code = '2801'), 'a0000000-0000-0000-0000-000000000002', 1, 'matched', now(), 'a0000000-0000-0000-0000-000000000002', now() - interval '3 hours')
on conflict (id) do nothing;

-- 학생 명단 (priority = 힌트)
insert into request_passengers (id, request_id, name, phone, school_or_role, priority) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '김영희', '010-1111-2222', '부산대', 1),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', '박민수', '010-1111-3333', '부경대', 2),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', '이지은', '010-3333-4444', '부산대', 1)
on conflict (id) do nothing;

-- 매칭 (paid) + 예약번호 — 학생 진입 테스트용. payment_due_at = nullable(v1.1)이라 생략.
insert into matches (id, trip_id, request_id, passenger_id, status, payment_reported_at, paid_at, reservation_code) values
  ('10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000003', 'paid', now() - interval '1 hour', now() - interval '30 minutes', 'BUS-7K9M')
on conflict (id) do nothing;

-- 예약번호 검증용 (이름 + 전화 끝 4자리)
insert into match_passengers (id, match_id, name, phone, school_or_role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '이지은', '010-3333-4444', '부산대')
on conflict (id) do nothing;
