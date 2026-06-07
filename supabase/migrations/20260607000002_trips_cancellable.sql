-- 지구 차량(trip) 취소 — 공급 간사가 공개/임시 차량을 취소. (사용자 요청 2026-06-07)
--
-- 조건(앱 레이어 cancelTrip가 강제): **활성 매칭(자리 점유)이 하나도 없을 때만** 취소 가능.
--   활성 = awaiting_payment | payment_reported | paid. 매칭이 있었다가 전부 해제/취소돼
--   활성 0이 되면 다시 취소 가능. 취소 시 좌석 공급 마감 + 대기(queued) 신청 취소 + 재신청 추천 알림.
--
-- status에 'cancelled' 추가(‘closed’=마감/완료와 의미 구분) + 취소 메타(시각·사유).

alter table trips drop constraint trips_status_check;
alter table trips add constraint trips_status_check
  check (status in ('draft', 'published', 'closed', 'cancelled'));

alter table trips add column cancelled_at timestamptz;
alter table trips add column cancellation_reason text;
