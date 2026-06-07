-- chat_mutes — 채팅방(trip)별 사용자 푸시 음소거 토글. 보안점검 Finding 3.
--
-- 채팅 메시지(chat_message)의 PWA 푸시를 방 단위로 끄고 싶은 사용자(간사·학생)의 옵트아웃 기록.
--   · 인앱 알림은 그대로 유지 — 오직 푸시(deliverPushBatch)만 제외(lib/chat/notify.ts).
--   · 기본값(row 없음) = 음소거 아님(푸시 받음). 토글 ON 시 row(muted=true) 생성/갱신.
--
-- 소유자 = operator 또는 passenger 중 정확히 하나 (push_subscriptions 와 동일 패턴).
--   · operator_id  = operators.id (간사 식별)
--   · passenger_id = match_passengers.id (학생 채팅 subjectId)
--   · 마스터는 채팅 비참여 → row 없음.
-- (trip_id, 소유자)는 1:1 — lib/chat/mutes.ts 가 select-후-insert/update 로 토글.

create table chat_mutes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  operator_id uuid references operators (id) on delete cascade,
  passenger_id uuid references match_passengers (id) on delete cascade,
  muted boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 소유자는 정확히 하나 (operator XOR passenger). 마스터·무소유 row 차단.
  constraint chat_mutes_one_owner check (num_nonnulls(operator_id, passenger_id) = 1)
);

-- 방+소유자 1:1 (소유자 한쪽만 non-null이라 부분 unique 인덱스 둘로 분리)
create unique index chat_mutes_trip_operator_uniq
  on chat_mutes (trip_id, operator_id) where operator_id is not null;
create unique index chat_mutes_trip_passenger_uniq
  on chat_mutes (trip_id, passenger_id) where passenger_id is not null;

create index idx_chat_mutes_trip on chat_mutes (trip_id);

-- 서버(service_role) 전용 — 앱이 세션으로 소유자 검증 후 접근. RLS deny-default.
alter table chat_mutes enable row level security;

-- 민감 테이블 추가 시 anon/authenticated GRANT revoke (20260605000002 정책과 동일).
revoke all on chat_mutes from anon, authenticated;
