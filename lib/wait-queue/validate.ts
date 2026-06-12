/**
 * 버스 미배정 대기큐 — 입력 검증 (순수 함수, 테스트 대상).
 * 간사(createWaitRequest)·학생(createStudentWaitRequest) 서버 액션이 공용으로 사용.
 */

/** 대기 신청 방향 — trips.direction과 동일 enum. 가는편(up)/오는편(down). */
export type WaitDirection = "up" | "down";

export function isWaitDirection(value: unknown): value is WaitDirection {
  return value === "up" || value === "down";
}

/**
 * 희망 출발일(선택) 검증 — 형식(YYYY-MM-DD)·실존 날짜만 본다(과거 날짜는 관대하게 허용).
 * 빈 값(null/undefined/공백)은 "희망일 없음"으로 통과(value=null).
 */
export function validateDesiredDate(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return { ok: true, value: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false, error: "희망 날짜는 YYYY-MM-DD 형식으로 입력해주세요." };
  }
  // 2026-02-31 같은 형식만 맞는 가짜 날짜 차단 — UTC 고정으로 타임존 영향 제거.
  const [y, m, d] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return { ok: false, error: "존재하지 않는 날짜예요. 희망 날짜를 확인해주세요." };
  }
  return { ok: true, value: trimmed };
}

type GuardResult = { ok: true } | { ok: false; error: string };

/**
 * 간사 대기 신청의 대상 지구 가드 — 실존(조회 결과 null 체크) + 본인 지구 금지.
 * trip 신청의 "본인 지구 차량 불가"와 동일 취지. region은 DB 조회 결과를 그대로 받는다.
 */
export function validateOperatorWaitRegion(
  region: { id: string } | null,
  sessionRegionId: string,
): GuardResult {
  if (!region) return { ok: false, error: "지구를 찾을 수 없습니다." };
  if (region.id === sessionRegionId) {
    return { ok: false, error: "본인 지구 대기큐에는 신청할 수 없습니다." };
  }
  return { ok: true };
}

/** 학생의 기존 미배정(queued + trip_id null) 대기 신청 키 — 중복 판정에 필요한 최소 컬럼. */
export type WaitRequestKey = {
  wait_region_id: string | null;
  wait_direction: string | null;
};

/**
 * 학생 대기 신청 중복 가드 — 같은 지구 + 같은 방향의 미배정 대기 신청이 이미 있으면 true.
 * existing은 호출부가 "본인 + queued + trip_id null"로 좁혀 조회한 행들.
 */
export function hasDuplicateWaitRequest(
  existing: WaitRequestKey[],
  waitRegionId: string,
  direction: WaitDirection,
): boolean {
  return existing.some(
    (r) => r.wait_region_id === waitRegionId && r.wait_direction === direction,
  );
}

/** assignWaitToTrip 검증 대상 — 대기 신청 행(DB 조회 결과, 없으면 null). */
export type WaitAssignRequestRow = {
  status: string;
  trip_id: string | null;
  wait_region_id: string | null;
  wait_direction: string | null;
};

/** assignWaitToTrip 검증 대상 — 배정할 차량 행(본인 지구로 좁혀 조회, 없으면 null). */
export type WaitAssignTripRow = {
  status: string;
  direction: string;
};

/**
 * 대기 신청 → 버스 배정(assignWaitToTrip) 검증 — 순수 부분.
 * 신청: 내 지구 대기큐(wait_region_id) 소속 + 미배정(trip_id null) + queued.
 * 차량: 실존(본인 지구 조회 결과) + published + 대기 방향(가는편/오는편) 일치.
 */
export function validateWaitAssignment(
  request: WaitAssignRequestRow | null,
  trip: WaitAssignTripRow | null,
  sessionRegionId: string,
): GuardResult {
  if (!request || request.wait_region_id !== sessionRegionId) {
    return { ok: false, error: "대기 신청을 찾을 수 없습니다." };
  }
  if (request.trip_id !== null) {
    return { ok: false, error: "이미 버스가 배정된 신청입니다." };
  }
  if (request.status !== "queued") {
    return { ok: false, error: "이미 처리된 신청입니다." };
  }
  if (!trip) return { ok: false, error: "차량을 찾을 수 없습니다." };
  if (trip.status !== "published") {
    return { ok: false, error: "공개(published) 상태의 차량에만 배정할 수 있습니다." };
  }
  if (trip.direction !== request.wait_direction) {
    return {
      ok: false,
      error: "차량 방향(가는편/오는편)이 대기 신청과 달라 배정할 수 없습니다.",
    };
  }
  return { ok: true };
}
