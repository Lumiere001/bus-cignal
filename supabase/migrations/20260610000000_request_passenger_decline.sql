-- ─────────────────────────────────────────────
-- request_passengers — 개별 학생 거절(선택 거절) 지원
-- ─────────────────────────────────────────────
-- 공급 간사가 대기 신청의 '체크한 학생만' 거절할 수 있도록 표시 컬럼 추가.
-- 기록(이름·전화·우선순위)은 보존하고, 대기 큐 표시에서만 제외한다(사용자 요청 2026-06-10).
--   · declined_at  : 거절 시각(NULL = 활성/대기). 큐 조회는 declined_at IS NULL만 노출.
--   · decline_reason: 거절 사유(선택). 신청 지구 안내·감사 추적용.
-- 신청 1건의 모든 학생이 거절되면 앱 레이어에서 seat_requests.status='rejected'로 마감한다.

alter table request_passengers add column declined_at timestamptz;
alter table request_passengers add column decline_reason text;

-- 활성(미거절) 학생 조회 가속 — 큐 구성 시 request_id로 모아 declined_at IS NULL 필터.
create index idx_request_passengers_active
  on request_passengers (request_id)
  where declined_at is null;
