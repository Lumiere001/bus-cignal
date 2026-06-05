-- Bus Cignal — RLS 하드닝: PII/민감 11테이블 GRANT 명시 revoke (deny-default 다층 방어)
-- 결정: docs/decisions/2026-06-05-rls-deny-default-boundary.md
--
-- 배경 (접근 모델):
--   · 앱은 전량 service_role(lib/supabase/admin.ts, createAdminClient)로 DB 접근 → RLS 우회.
--   · 세션은 커스텀 JWT(jose HS256, lib/auth/*-session.ts)라 PostgREST가 해석 못함
--     → DB 안에서 auth.uid()/auth.jwt() = 항상 null → 지구별·본인행 RLS는 우리 세션엔 무의미.
--   · 따라서 DB RLS의 실효 역할 = "브라우저에 노출된 anon 키로 PostgREST(/rest/v1) 직격" 차단.
--     그 차단은 이미 20260528000002_enable_rls.sql 의 RLS enable + 무정책(deny-default)으로 성립.
--
-- 이 마이그의 목적 (belt + 멜빵):
--   RLS enable 만으로도 anon/authenticated는 정책 없는 테이블을 못 읽지만,
--   누군가 실수로 `alter table ... disable row level security` 하면 GRANT가 남아 노출될 수 있다.
--   → PII/민감 테이블의 anon·authenticated GRANT 자체를 제거해, RLS 비활성화 사고에도 deny 유지.
--
-- 영향 범위:
--   · service_role 은 별도 롤(BYPASSRLS + 자체 grant)이라 이 revoke에 영향 없음 → 앱 동작 무영향.
--   · 공개읽기 2테이블(regions·region_locations)은 revoke 대상 제외 = GRANT 유지.
--     (유일한 anon 클라이언트 사용처 app/operator/trips/new 가 region_locations 만 읽음)
--   · 향후 새 테이블은 supabase default privileges 로 grant가 재부여될 수 있으니,
--     민감 테이블 추가 시 동일 revoke를 함께 작성할 것.

revoke all on operators           from anon, authenticated;
revoke all on trips               from anon, authenticated;
revoke all on seat_offers         from anon, authenticated;
revoke all on seat_requests       from anon, authenticated;
revoke all on request_passengers  from anon, authenticated;
revoke all on matches             from anon, authenticated;
revoke all on match_passengers    from anon, authenticated;
revoke all on notifications       from anon, authenticated;
revoke all on rejection_log       from anon, authenticated;
revoke all on system_config       from anon, authenticated;
revoke all on push_subscriptions  from anon, authenticated;

-- 공개읽기 유지 (비-PII, 정책 = SELECT using(true)):
--   regions, region_locations → revoke 하지 않음.
