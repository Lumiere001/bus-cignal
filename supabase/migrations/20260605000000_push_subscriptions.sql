-- push_subscriptions — PWA/FCM 웹푸시 구독 토큰 (옵트인). SPEC §9.3 · §S8.
--
-- 간사·학생이 "홈 화면 추가 + 알림 허용"을 하면 FCM registration token을 여기 등록한다.
-- 실제 발송은 lib/notifications 의 deliverPushBatch() (Firebase Admin sendEachForMulticast).
--
-- 소유자 = operator 또는 passenger 중 정확히 하나.
--   · 마스터는 기기 구독이 없다 (MASTER_PASSWORD_HASH env 인증, 인앱 알림만) → 여기 row 없음.
--   · 한 사람이 여러 기기/브라우저를 쓸 수 있으므로 (operator_id, token)은 1:N.
-- token 은 전역 unique: 같은 기기가 재로그인하며 소유자가 바뀌면 upsert(on conflict token)로 소유자 재지정.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references operators (id) on delete cascade,
  passenger_id uuid references match_passengers (id) on delete cascade,
  token text not null unique,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  -- 소유자는 정확히 하나 (operator XOR passenger). 마스터·무소유 row 차단.
  constraint push_sub_one_owner check (num_nonnulls(operator_id, passenger_id) = 1)
);

create index idx_push_sub_operator on push_subscriptions (operator_id);
create index idx_push_sub_passenger on push_subscriptions (passenger_id);

-- 서버(service_role) 전용. 앱 레이어(세션)에서 소유자 검증 후 접근하므로 RLS 기본 deny.
-- (다른 테이블과 동일한 정책 — SPEC §8 RLS 실적용 시점에 세분 정책 추가)
alter table push_subscriptions enable row level security;
