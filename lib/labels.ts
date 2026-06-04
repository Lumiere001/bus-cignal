// 공유 라벨 헬퍼 — 팀원1·2 모두 사용 (변경 시 팀장 합의 필요)

export const DIRECTION_LABEL: Record<"up" | "down", string> = {
  up: "상행 (지역 → 평창)",
  down: "하행 (평창 → 지역)",
};

export const DIRECTION_SHORT: Record<"up" | "down", string> = {
  up: "상행",
  down: "하행",
};

export const TRIP_STATUS_LABEL: Record<"draft" | "published" | "closed", string> = {
  draft: "임시저장",
  published: "공개중",
  closed: "마감",
};

export const TRIP_STATUS_COLOR: Record<"draft" | "published" | "closed", string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  closed: "bg-red-100 text-red-600",
};

export const MATCH_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "송금 대기",
  payment_reported: "송금 보고됨",
  paid: "입금 확인",
  expired: "자리 풀림",
  cancelled: "취소",
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  queued: "대기중",
  matched: "매칭됨",
  rejected: "거절됨",
  cancelled: "취소됨",
};
