/**
 * 알림 이벤트 카탈로그 — SPEC §8 (18개 + 권한 해제 + 대기큐 3종).
 * 채널: 인앱 + PWA 푸시(옵트인). 이메일·SMS·알림톡 X.
 *
 * 이 파일은 순수(server-only X) — 상수·타입만. 실제 발송은 ./index 의 emit().
 */
export const NOTIFICATION_EVENTS = {
  REQUEST_NEW: "request_new", // 매칭 큐 신규 신청 → 공급
  REQUEST_CANCELLED: "request_cancelled", // 대기 중 신청 취소(신청 간사) → 공급
  MATCH_CONFIRMED: "match_confirmed", // 매칭 확정 → 신청
  MATCH_REJECTED: "match_rejected", // 거절 + 사유 → 신청
  PASSENGERS_DECLINED: "passengers_declined", // 신청 학생 일부 거절(선택 거절, 나머지 대기) → 신청
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
  WAIT_REQUEST_NEW: "wait_request_new", // 버스 미배정 대기 신청 → 대상 지구 승인 간사 전원
  WAIT_REQUEST_CANCELLED: "wait_request_cancelled", // 대기 신청 취소 → 대상 지구 승인 간사 전원
  WAIT_ASSIGNED: "wait_assigned", // 대기 신청에 버스 배정 → 수요측 신청 주체
} as const;

export type NotificationEvent =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

/**
 * 수신자 슬롯 — emit()이 받는 대상 식별자.
 * - 키는 이벤트별로 컴파일 타임 강제(RecipientsFor) → 호출자가 누락 못 함.
 * - 값은 nullable(string|null): 실데이터에서 공급 간사 미지정 등 가능 → 런타임에 skip.
 * - master는 운영자 row가 없음(MASTER_PASSWORD_HASH env 인증) → operator_id·passenger_id 모두 null로 기록.
 */
export type RecipientSlots = {
  /** 공급 지구(버스 내는 쪽) 간사 */
  supplyOperatorId: string | null;
  /** 신청 지구(타는 쪽) 간사 */
  requestOperatorId: string | null;
  /** 신청 지구 간사 여럿 — K2 재신청 추천(거절·만료된 지구들) */
  requestOperatorIds: string[];
  /** 임의 간사 목록 — 권한 해제(해당 + 동지구 다른 간사) */
  operatorIds: string[];
  /** 학생 (match_passengers.id) */
  passengerId: string | null;
  /** 마스터 — 별도 식별자 없음 (둘 다 null row) */
  master: true;
};

/** 이벤트 → 필요한 수신자 슬롯. SPEC §8 대상 컬럼 그대로. */
export const EVENT_SLOTS = {
  request_new: ["supplyOperatorId"],
  request_cancelled: ["supplyOperatorId"],
  match_confirmed: ["requestOperatorId"],
  match_rejected: ["requestOperatorId"],
  passengers_declined: ["requestOperatorId"],
  partial_match: ["supplyOperatorId", "requestOperatorId"],
  seat_freed: ["requestOperatorId", "passengerId"],
  payment_delay_pre: ["requestOperatorId"],
  payment_delay: ["supplyOperatorId", "requestOperatorId"],
  payment_reported: ["supplyOperatorId"],
  paid_code_issued: ["requestOperatorId", "passengerId"],
  match_cancelled_p2: ["requestOperatorId"],
  passenger_cancelled: ["supplyOperatorId", "requestOperatorId"],
  reapply_recommended: ["requestOperatorIds"],
  depart_d1: ["supplyOperatorId", "requestOperatorId", "passengerId"],
  depart_d1h: ["supplyOperatorId", "requestOperatorId", "passengerId"],
  trip_changed: ["supplyOperatorId", "requestOperatorId", "passengerId"],
  rejection_occurred: ["master"],
  system_error: ["master"],
  chat_message: ["supplyOperatorId", "requestOperatorId", "passengerId"],
  operator_revoked: ["operatorIds"],
  // 대기큐 이벤트 — 대상 지구는 간사 row가 특정되지 않으므로 호출자가
  // approvedOperatorIdsForRegions(targets.ts)로 지구→승인 간사 전원을 풀어 operatorIds로 전달.
  wait_request_new: ["operatorIds"],
  wait_request_cancelled: ["operatorIds"],
  // 수요측 주체 — operator 신청이면 requestOperatorId(지구 fan-out은 emit 기존 정책),
  // 학생 신청이면 passengerId(연결 가능한 match_passengers 있을 때만 — 없으면 null로 skip).
  wait_assigned: ["requestOperatorId", "passengerId"],
} as const satisfies Record<
  NotificationEvent,
  readonly (keyof RecipientSlots)[]
>;

/**
 * 이벤트별 페이로드 — 인앱 카드 렌더·딥링크에 필요한 최소 데이터.
 * notifications.payload(jsonb)에 그대로 저장.
 */
export interface NotificationPayloads {
  request_new: { requestId: string; tripId: string; seatCount: number };
  request_cancelled: { requestId: string; tripId: string };
  match_confirmed: { matchId: string; tripId: string };
  match_rejected: { requestId: string; reason: string };
  passengers_declined: { requestId: string; declinedCount: number; reason?: string };
  partial_match: { matchId: string; requestId: string; seatCount: number };
  seat_freed: { tripId: string; requestId?: string };
  payment_delay_pre: { matchId: string };
  payment_delay: { matchId: string };
  payment_reported: { matchId: string };
  paid_code_issued: { matchId: string; reservationCode: string };
  match_cancelled_p2: { matchId: string; reason?: string };
  passenger_cancelled: { matchId: string; passengerName?: string };
  reapply_recommended: { tripId: string };
  depart_d1: { tripId: string; departureAt: string };
  depart_d1h: { tripId: string; departureAt: string };
  trip_changed: { tripId: string; changed: string[] };
  rejection_occurred: { requestId: string; reason: string };
  system_error: { context: string; detail?: string };
  chat_message: { tripId: string; preview?: string };
  operator_revoked: { operatorId: string };
  wait_request_new: { requestId: string; waitRegionId: string; seatCount: number };
  wait_request_cancelled: { requestId: string; waitRegionId: string };
  wait_assigned: { requestId: string; tripId: string };
}

/** 이벤트가 요구하는 수신자 객체 타입 (슬롯 키만 강제). */
export type RecipientsFor<E extends NotificationEvent> = {
  [K in (typeof EVENT_SLOTS)[E][number]]: RecipientSlots[K];
};

/** 이벤트의 페이로드 타입. */
export type PayloadFor<E extends NotificationEvent> =
  E extends keyof NotificationPayloads ? NotificationPayloads[E] : never;
