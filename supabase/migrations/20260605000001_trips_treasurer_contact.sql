-- trips: 총무(학생 담당) 연락처 — 이슈 #25 (결정 2 후속, docs/decisions/2026-06-03-...).
--
-- 학생 화면의 '담당 간사/총무 카드'에서 학생이 연락할 총무 정보.
--  · 담당 간사 연락처는 operators.phone(가입 시 등록)로 커버 → 추가 컬럼 없음.
--  · 집합지는 출발지(region_locations origin 드롭다운)로 갈음 → 자유텍스트 컬럼 없음 (SPEC §5.3·§5.4).
--  · nullable: 기존 trip row가 있고, 모든 Trip에 별도 총무가 있는 건 아님. 폼 필수화는 앱레이어(팀원1 Zod)에서.

alter table trips
  add column treasurer_name  text,   -- 총무 이름
  add column treasurer_phone text;   -- 총무 연락처
