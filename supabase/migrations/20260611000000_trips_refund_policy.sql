-- trips: 환불 정책 — 공급 차량 등록 시 선택 입력 (사용자 요청 2026-06-11).
--
-- 입금 계좌(bank_*)와 같은 맥락 — 매칭(송금 대기) 후 신청 지구 간사·학생에게
-- 계좌 안내와 함께 노출한다. 선택 입력이므로 nullable, 미입력 차량은 표시 생략.
alter table trips
  add column refund_policy text;  -- 환불 정책 (예: 출발 3일 전까지 전액 환불)
