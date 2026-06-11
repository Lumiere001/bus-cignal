-- request_passengers: 개별 신청 시각 — 사전 수합분 가져오기에서 학생마다 다른 신청 시각
-- (구글폼 타임스탬프)을 보존하기 위함 (사용자 요청 2026-06-11).
--
-- 대기 큐의 "시간순" 뷰는 지구를 가로질러 학생 개개인을 신청 시각으로 정렬한다.
-- 이 값이 없는(일반 간사·학생 신청) 학생은 소속 신청의 requested_at으로 폴백 — 앱레이어 처리.
alter table request_passengers
  add column applied_at timestamptz;  -- 개인 신청 시각 (없으면 seat_requests.requested_at 사용)
