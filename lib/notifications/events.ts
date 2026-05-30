/**
 * 알림 이벤트 카탈로그 — SPEC §8 (18개 + 권한 해제).
 * 채널: 인앱 + PWA 푸시(옵트인). 이메일·SMS·알림톡 X.
 */
export const NOTIFICATION_EVENTS = {
  REQUEST_NEW: "request_new", // 매칭 큐 신규 신청 → 공급
  MATCH_CONFIRMED: "match_confirmed", // 매칭 확정 → 신청
  MATCH_REJECTED: "match_rejected", // 거절 + 사유 → 신청
  PARTIAL_MATCH: "partial_match", // 부분 매칭 처리(간사 수동) → 양쪽
  SEAT_FREED: "seat_freed", // 자리 풀림/큐 재노출 → 신청 + 학생
  PAYMENT_DELAY_PRE: "payment_delay_pre", // 송금 지연 사전 알림 → 신청
  PAYMENT_DELAY: "payment_delay", // 송금 장기 지연 — [자리 풀기] 권유 → 양쪽
  PAYMENT_REPORTED: "payment_reported", // 송금 완료 보고 → 공급
  PAID_CODE_ISSUED: "paid_code_issued", // 입금 확인 + 예약번호 발급 → 신청 + 학생
  MATCH_CANCELLED_P2: "match_cancelled_p2", // 매칭 취소(Phase 2) → 신청
  PASSENGER_CANCELLED: "passenger_cancelled", // 학생 자의 취소 → 양쪽 간사
  REAPPLY_RECOMMENDED: "reapply_recommended", // 재신청 추천 → 거절·취소된 신청 지구
  DEPART_D1: "depart_d1", // 출발 D-1 → 양쪽 + 학생
  DEPART_D1H: "depart_d1h", // 출발 D-1h → 양쪽 + 학생
  TRIP_CHANGED: "trip_changed", // Trip 변경(시간·location·요금) → 양쪽 + 학생
  REJECTION_OCCURRED: "rejection_occurred", // 거절 발생 → 마스터
  SYSTEM_ERROR: "system_error", // 시스템 장애 → 마스터
  CHAT_MESSAGE: "chat_message", // 채팅 새 메시지 → 양쪽 + 학생 (푸시 ON/OFF)
  OPERATOR_REVOKED: "operator_revoked", // 간사 권한 해제 → 해당 + 동지구 간사
} as const;

export type NotificationEvent =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
