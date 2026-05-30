-- Bus Cignal v1.1 — 간사 인증 CCC 로그인 전환 (SPEC §2.2 · §6 · §8)
-- operators: Google OAuth(google_uid) → CCC 로그인(ccc_id) + campus · ccc_role
--
-- ※ 간사 인증은 Supabase Auth(Google OAuth)를 쓰지 않고, CCC가 전달한 신원을
--    검증한 뒤 자체 세션(JWT 쿠키)을 발급한다. 신원 전달 방식(서명 토큰 / 일회용
--    코드 / OIDC)은 CCC IT 확정 후 별도 마이그/코드에서 반영.
-- ※ "차량 간사 여부"는 CCC가 제공하지 않으므로 approval_status(마스터 승인)가
--    권한의 최종 결정권자 — 기존 승인 흐름 유지.

-- 1) 식별자: google_uid → ccc_id (unique 제약은 컬럼 rename과 함께 유지됨)
alter table operators rename column google_uid to ccc_id;

-- 2) CCC에서 받아오는 부가 정보
alter table operators add column if not exists campus text;
alter table operators add column if not exists ccc_role text;  -- 간사/순장/순원 (CCC 제공 시)

-- 3) 문서화
comment on column operators.ccc_id   is 'CCC 고유·불변 식별자 (구 google_uid). CCC 로그인 신원 매핑 키';
comment on column operators.campus   is 'CCC 캠퍼스(학교). 미제공 시 null';
comment on column operators.ccc_role is 'CCC 직분 간사/순장/순원 (확인 예정, 권한 보조용). 미제공 시 null';

-- ※ email은 이미 nullable — CCC는 이메일·성별을 전달하지 않음(미수집, PIPA 최소수집).

-- 4) v1.1 매칭 수동화: 24h 자동 만료 폐지 → payment_due_at은 더 이상 강제 불필요(nullable).
--    송금 지연 리마인더는 matched_at + threshold로 계산 (due 컬럼 미사용/선택).
alter table matches alter column payment_due_at drop not null;
comment on column matches.payment_due_at is 'v1.1: 자동 만료 폐지로 선택값(nullable). 리마인더는 matched_at 기준';
