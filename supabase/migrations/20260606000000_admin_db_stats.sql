-- 마스터 운영 모니터링 — DB 용량/테이블 크기 집계 (읽기 전용).
-- pg_database_size·pg_total_relation_size는 PostgREST(REST)로 못 부르므로
-- SECURITY DEFINER 함수로 노출한다. 호출은 service_role 전용(앱의 admin client).
-- 개인정보·행 데이터는 반환하지 않는다(용량 메타데이터만) → PII 유출 없음.

create or replace function public.admin_db_stats()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    -- public 스키마 사용자 테이블별 총 크기(인덱스·toast 포함). 키=테이블명, 값=bytes.
    'tables', coalesce((
      select jsonb_object_agg(relname, total_bytes)
      from (
        select c.relname::text as relname,
               pg_total_relation_size(c.oid) as total_bytes
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
      ) s
    ), '{}'::jsonb)
  );
$$;

-- 익명/로그인 사용자에게는 노출하지 않는다(20260605000002 하드닝과 동일 경계).
revoke all on function public.admin_db_stats() from public, anon, authenticated;
grant execute on function public.admin_db_stats() to service_role;

comment on function public.admin_db_stats() is
  '마스터 운영 모니터링용 DB 용량 집계(service_role 전용). 행 데이터 미반환.';
