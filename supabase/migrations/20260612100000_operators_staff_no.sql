-- Bus Cignal — operators.staff_no (CCC 간사번호, 보조 식별키)
--
-- 배경: CCC Summer 핸드오프 exchange의 subject_id(=ccc_id)가 같은 사람에게
-- 로그인 세션마다 달라지는 사례가 prod에서 확인됨 (같은 phone·name 간사에게
-- ccc_id 3개 생성). ccc_id를 고유·불변으로 가정한 upsert가 매 로그인마다
-- 새 행을 만들어 신원이 분열 → revoke 우회·권한 화면 중복 위험.
--
-- 대응: staff_no(CCC 간사번호)를 보조 식별키로 저장하고, 프로비저닝에서
-- ccc_id 미스 시 staff_no → phone+name 순으로 기존 신원을 찾아 자기치유
-- (lib/ccc/provision.ts). 학생(students)은 staff_no가 없어 phone+name만 사용.

alter table operators add column staff_no text;

comment on column operators.staff_no is
  'CCC 간사번호 — subject_id(ccc_id)가 세션마다 불안정해 보조 식별키로 사용. 미제공 시 null';

-- 자기치유 조회용 (null 제외 부분 인덱스). unique 아님 — 값 충돌 시에도
-- 프로비저닝이 created_at 최초 행을 본인으로 채택한다.
create index idx_operators_staff_no on operators (staff_no) where staff_no is not null;
