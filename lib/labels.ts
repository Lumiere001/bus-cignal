// 공유 라벨 헬퍼 — 팀원1·2 모두 사용 (변경 시 팀장 합의 필요)

// 방향 라벨 — 사용자 노출 용어는 '가는편'(지역→평창) / '오는편'(평창→지역).
// 코드 키 up/down 은 불변(스키마·로직 기준). 용어 변경 시 이 두 맵만 교체.
export const DIRECTION_LABEL: Record<"up" | "down", string> = {
  up: "가는편 (지역 → 평창)",
  down: "오는편 (평창 → 지역)",
};

export const DIRECTION_SHORT: Record<"up" | "down", string> = {
  up: "가는편",
  down: "오는편",
};

export type TripStatus = "draft" | "published" | "closed" | "cancelled";

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  draft: "임시저장",
  published: "공개중",
  closed: "마감",
  cancelled: "취소됨",
};

export const TRIP_STATUS_COLOR: Record<TripStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  closed: "bg-red-100 text-red-600",
  cancelled: "bg-rose-100 text-rose-700",
};

export const MATCH_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "송금 대기",
  payment_reported: "송금 보고됨",
  paid: "입금 확인",
  expired: "매칭 취소됨",
  cancelled: "취소",
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  queued: "대기중",
  matched: "매칭됨",
  rejected: "거절됨",
  cancelled: "취소됨",
};

// 매칭 목록 정렬 기준 — 생애주기(진행) 순서. 송금완료/입금확인 클릭 후에도 자리가
// 튀지 않도록 이 순서 + 안정 보조정렬(matched_at·id)로 결정적 정렬에 사용.
export const MATCH_STATUS_ORDER: Record<string, number> = {
  awaiting_payment: 0,
  payment_reported: 1,
  paid: 2,
  expired: 3,
  cancelled: 4,
};
