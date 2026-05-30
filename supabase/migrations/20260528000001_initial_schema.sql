-- Bus Cignal — 초기 스키마 (v1.0 SPEC §6)
-- 12 테이블 + 익명화 컬럼 (SPEC §7 anonymize, §10.3)
-- 생성 순서: 참조 의존성 따라 regions → operators → region_locations → trips → ...

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- regions — 전국 지구
-- ─────────────────────────────────────────────
create table regions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  area text,
  category text not null check (category in ('regular', 'special_ministry', 'overseas')),
  bank_account text,
  bank_name text,
  account_holder text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- operators — 차량 간사 (Google OAuth + 마스터 승인)
-- ※ master role 없음 (마스터는 MASTER_PASSWORD_HASH env로만 인증)
-- ─────────────────────────────────────────────
create table operators (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references regions (id),
  google_uid text unique,
  email text,
  name text,
  phone text,
  requested_region_id uuid references regions (id),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'revoked')),
  approved_at timestamptz,
  approved_by uuid references operators (id),
  revoked_at timestamptz,
  revoke_reason text,
  role text not null default 'operator' check (role in ('operator')),
  anonymized boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- region_locations — 가입 시 등록 출발/도착지 (SPEC §5.3)
-- ─────────────────────────────────────────────
create table region_locations (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references regions (id),
  direction text not null check (direction in ('up', 'down')),
  location_type text not null check (location_type in ('origin', 'destination')),
  address text not null,
  lat numeric,
  lng numeric,
  label text,
  is_default boolean not null default false,
  created_by uuid references operators (id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- trips — 운행 (등록 location 참조)
-- ─────────────────────────────────────────────
create table trips (
  id uuid primary key default gen_random_uuid(),
  operator_region_id uuid not null references regions (id),
  direction text not null check (direction in ('up', 'down')),
  origin_location_id uuid not null references region_locations (id),
  destination_location_id uuid not null references region_locations (id),
  departure_at timestamptz not null,
  capacity int not null check (capacity > 0),
  price_per_seat int not null check (price_per_seat >= 0),
  note text,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by uuid references operators (id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- seat_offers — 공급 슬라이스
-- ─────────────────────────────────────────────
create table seat_offers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  seat_count int not null check (seat_count > 0),
  posted_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- seat_requests — 신청 슬라이스 (FIFO 큐, parent로 분할)
-- ─────────────────────────────────────────────
create table seat_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  region_id uuid not null references regions (id),
  operator_id uuid not null references operators (id),
  parent_request_id uuid references seat_requests (id),
  seat_count int not null check (seat_count > 0),
  requested_at timestamptz not null default now(),
  status text not null default 'queued'
    check (status in ('queued', 'matched', 'rejected', 'cancelled')),
  reject_reason text,
  consent_confirmed_at timestamptz,
  consent_confirmed_by uuid references operators (id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- request_passengers — 신청에 묶인 학생 + 우선순위 (request 내 unique)
-- ─────────────────────────────────────────────
create table request_passengers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references seat_requests (id) on delete cascade,
  name text not null,
  phone text not null,
  school_or_role text,
  note text,
  priority int not null,
  anonymized boolean not null default false,
  created_at timestamptz not null default now(),
  unique (request_id, priority)
);

-- ─────────────────────────────────────────────
-- matches — 매칭 (학생 1명당 1개)
-- ─────────────────────────────────────────────
create table matches (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  request_id uuid not null references seat_requests (id),
  passenger_id uuid not null references request_passengers (id),
  matched_at timestamptz not null default now(),
  payment_due_at timestamptz not null,
  payment_reported_at timestamptz,
  paid_at timestamptz,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'payment_reported', 'paid', 'expired', 'cancelled')),
  reservation_code text unique,
  cancellation_source text check (cancellation_source in ('operator', 'passenger', 'system')),
  cancellation_reason text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- match_passengers — 예약번호 검증용 (이름 + 전화 끝 4자리)
-- ─────────────────────────────────────────────
create table match_passengers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  name text not null,
  phone text not null,
  school_or_role text,
  access_token_hash text,
  last_seen_at timestamptz,
  anonymized boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- notifications — 인앱·푸시 (발송 실패 재시도 추적)
-- ─────────────────────────────────────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references operators (id),
  passenger_id uuid references match_passengers (id),
  type text not null,
  payload jsonb,
  channel text not null check (channel in ('in_app', 'push')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  retry_count int not null default 0,
  last_attempt_at timestamptz,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- rejection_log — 거절 단순 로그 (V1)
-- ─────────────────────────────────────────────
create table rejection_log (
  id uuid primary key default gen_random_uuid(),
  seat_request_id uuid not null references seat_requests (id),
  rejected_by uuid references operators (id),
  reason text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- system_config — 신청 마감일·점검 모드
-- ─────────────────────────────────────────────
create table system_config (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ─────────────────────────────────────────────
-- 인덱스 (FK + 자주 쓰는 쿼리)
-- ─────────────────────────────────────────────
create index idx_operators_region on operators (region_id);
create index idx_operators_approval on operators (approval_status);
create index idx_region_locations_region on region_locations (region_id);
create index idx_trips_region on trips (operator_region_id);
create index idx_trips_status on trips (status);
create index idx_seat_offers_trip on seat_offers (trip_id);
-- FIFO 큐 핵심 인덱스 (trip + status + 신청 시각)
create index idx_seat_requests_queue on seat_requests (trip_id, status, requested_at);
create index idx_seat_requests_region on seat_requests (region_id);
create index idx_request_passengers_request on request_passengers (request_id);
create index idx_matches_trip on matches (trip_id);
-- Phase 1 만료 cron 핵심 인덱스
create index idx_matches_expiry on matches (status, payment_due_at);
create index idx_match_passengers_match on match_passengers (match_id);
create index idx_notifications_operator on notifications (operator_id, read_at);
