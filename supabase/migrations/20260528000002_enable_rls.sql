-- Bus Cignal — RLS 활성화 (골격)
-- 세밀 정책(operator 본인 지구 W·passenger 본인 매칭 R/cancel 등 SPEC §8)은
-- P2-4 인증 스킴(auth.uid() ↔ operators 매핑) 확정 후 별도 마이그에서 정의.
-- 현재: 전체 RLS enable + 공개 읽기 테이블만. 나머지는 service_role(서버)로 접근.

alter table regions enable row level security;
alter table operators enable row level security;
alter table region_locations enable row level security;
alter table trips enable row level security;
alter table seat_offers enable row level security;
alter table seat_requests enable row level security;
alter table request_passengers enable row level security;
alter table matches enable row level security;
alter table match_passengers enable row level security;
alter table notifications enable row level security;
alter table rejection_log enable row level security;
alter table system_config enable row level security;

-- 공개 읽기 (지구·위치 = 민감 정보 아님)
create policy "regions readable by everyone"
  on regions for select using (true);

create policy "region_locations readable by everyone"
  on region_locations for select using (true);

-- ※ 그 외 10개 테이블: 정책 미정의 = service_role(서버)만 접근 가능.
--   operator/passenger 세밀 정책은 P2-4 인증 확정 후 추가 마이그.
