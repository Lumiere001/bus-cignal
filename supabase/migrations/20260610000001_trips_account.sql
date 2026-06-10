-- trips: 입금 계좌 — 공급 차량 등록 시 입력 (사용자 요청 2026-06-10).
--
-- 수요 지구 간사·학생이 매칭(송금 대기) 후 어디로 입금할지 알 수 있게 차량마다 계좌를 안내한다.
--  · 총무 연락처(treasurer_*)와 짝 — 총무가 관리하는 입금 계좌.
--  · nullable: 기존 trip row 호환(계좌 없던 차량은 '담당 간사 문의' fallback). 폼 필수화는 앱레이어(createTrip 검증).
alter table trips
  add column bank_name      text,   -- 은행명 (예: 카카오뱅크)
  add column account_number text,   -- 계좌번호
  add column account_holder text;   -- 예금주
