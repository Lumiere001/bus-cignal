-- Bus Cignal — 학생 직접 신청 (CCC 학생 로그인). docs/handoff-api (target_role=student).
-- 두 경로 공존:
--   (A) CCC 학생 로그인 → 본인 직접 신청 → 예약 확인 → 채팅   ← 이번 추가
--   (B) 기존 예약번호(/r) + 이름·전화끝4 조회                  ← 무변경
--
-- 학생 신원은 CCC ccc_id로 식별(operators.ccc_id와 같은 개념, 별도 students 테이블).

-- 1) students — CCC 로그인 학생. 로그인 시 upsert. (PII: name/phone)
create table students (
  id uuid primary key default gen_random_uuid(),
  ccc_id text unique not null,             -- CCC subject_id (불변 식별자)
  name text,
  phone text,
  region_id uuid references regions (id),   -- 출신 지구 (CCC branch_no 매핑)
  campus text,                              -- CCC univ_name (참고용)
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
comment on table students is
  'CCC 로그인 학생(본인 직접 신청). 예약번호(/r) 경로 학생과는 별개 신원(ccc_id).';
comment on column students.ccc_id is 'CCC 고유·불변 식별자. 학생 로그인 신원 매핑 키';

-- 2) seat_requests — 신청 주체를 간사 또는 학생으로.
alter table seat_requests alter column operator_id drop not null;
alter table seat_requests add column requester_kind text not null default 'operator'
  check (requester_kind in ('operator', 'student'));
alter table seat_requests add column student_id uuid references students (id);

-- 신청 주체는 간사(operator_id) 또는 학생(student_id) 중 정확히 하나.
-- 기존 행: requester_kind 기본 'operator' + operator_id not null(과거 제약) + student_id null → 충족.
alter table seat_requests add constraint seat_requests_requester_chk check (
  (requester_kind = 'operator' and operator_id is not null and student_id is null) or
  (requester_kind = 'student'  and student_id  is not null and operator_id is null)
);

create index idx_seat_requests_student on seat_requests (student_id);

-- 3) RLS — deny-default + PII revoke (기존 패턴 20260605000002). 앱은 service_role로만 접근.
alter table students enable row level security;
revoke all on students from anon, authenticated;
