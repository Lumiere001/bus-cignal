-- 학생 본인확인 무차별 대입 방어 — 예약번호별 시도 횟수/잠금.
-- 결정: docs/decisions/2026-06-05-passenger-verify-rate-limit.md
--   (2026-06-03 "rate-limit 미도입"을 갱신 — 링크 유출 시 이름+전화끝4 대입 위험 반영)
-- app은 service_role로 접근(RLS 우회). 외부 직격 차단 위해 enable + GRANT revoke(하드닝 일관).

create table reservation_verify_attempts (
  code text primary key,
  attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table reservation_verify_attempts enable row level security;
revoke all on reservation_verify_attempts from anon, authenticated;
