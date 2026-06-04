"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { available, approve } from "@/lib/matching";
import type { Match, MatchStatus, SeatRequest } from "@/lib/matching/types";
import { MatchingException, MatchingError } from "@/lib/matching/types";
import { generateReservationCode } from "@/lib/reservation/code";
import { emit } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | { ok: true };

// 송금 기한 = 매칭 후 24h (v1.1 소프트 — 자동 만료 아님, 리마인더 기준일 뿐. SPEC §7)
const PAYMENT_DUE_HOURS = 24;
// 예약번호 unique 충돌 시 재생성 횟수
const MAX_CODE_RETRIES = 5;

function firstOf<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

const MATCHING_ERROR_MESSAGE: Record<string, string> = {
  [MatchingError.EMPTY_SELECTION]: "최소 1명을 선택해주세요.",
  [MatchingError.INVALID_PASSENGER]: "잘못된 학생 선택입니다. 새로고침 후 다시 시도해주세요.",
  [MatchingError.NOT_ENOUGH_SEATS]: "남은 자리보다 많이 선택했습니다. 다시 확인해주세요.",
};

/** trip 소유권 확인 (본인 지구 공급 trip인지). 통과 시 trip 반환. */
async function loadOwnedTrip(
  db: ReturnType<typeof createAdminClient>,
  tripId: string,
  regionId: string,
) {
  const { data: trip } = await db
    .from("trips")
    .select("id, status, operator_region_id")
    .eq("id", tripId)
    .eq("operator_region_id", regionId)
    .single();
  return trip;
}

/** 공급 trip의 현재 잔여 자리 = sum(open offers) - active matches. */
async function computeAvailable(
  db: ReturnType<typeof createAdminClient>,
  tripId: string,
): Promise<number> {
  const [{ data: offers }, { data: matchRows }] = await Promise.all([
    db.from("seat_offers").select("seat_count, status").eq("trip_id", tripId),
    db.from("matches").select("id, status").eq("trip_id", tripId),
  ]);

  const openSeatCount = (offers ?? [])
    .filter((o) => o.status === "open")
    .reduce((sum, o) => sum + o.seat_count, 0);

  // available()은 .status만 읽음 — 나머지 필드는 형식 충족용
  const existingMatches: Match[] = (matchRows ?? []).map((m) => ({
    id: m.id,
    trip_id: tripId,
    request_id: "",
    passenger_id: "",
    status: m.status as MatchStatus,
    matched_at: "",
    paid_at: null,
    payment_reported_at: null,
    cancellation_source: null,
    cancellation_reason: null,
    reservation_code: null,
  }));

  return available(openSeatCount, existingMatches);
}

// ─── 승인 (선택 학생 → Match 생성) ──────────────────────────────────────────

export async function approveRequest(
  tripId: string,
  requestId: string,
  selectedPassengerIds: string[],
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const db = createAdminClient();

  const trip = await loadOwnedTrip(db, tripId, session.regionId);
  if (!trip) return { error: "Trip을 찾을 수 없습니다." };
  if (trip.status !== "published") return { error: "공개 상태의 Trip만 매칭할 수 있습니다." };

  // 신청 + 학생 로드 (이 trip의 queued 신청만)
  const { data: request } = await db
    .from("seat_requests")
    .select(
      `id, trip_id, operator_id, region_id, requested_at, status, seat_count,
       request_passengers(id, name, phone, priority, school_or_role, note)`,
    )
    .eq("id", requestId)
    .eq("trip_id", tripId)
    .single();

  if (!request) return { error: "신청을 찾을 수 없습니다." };
  if (request.status !== "queued") return { error: "이미 처리된 신청입니다." };

  const availableSeats = await computeAvailable(db, tripId);

  // 이중 매칭 방어: 선택 학생 중 이미 활성 매칭이 있는 사람 거부 (stale UI 대비)
  const { data: existing } = await db
    .from("matches")
    .select("passenger_id")
    .eq("request_id", requestId)
    .in("status", ["awaiting_payment", "payment_reported", "paid"]);
  const alreadyMatched = new Set((existing ?? []).map((m) => m.passenger_id));
  if (selectedPassengerIds.some((id) => alreadyMatched.has(id))) {
    return { error: "이미 매칭된 학생이 포함되어 있습니다. 새로고침 후 다시 시도해주세요." };
  }

  // 매칭 엔진(core)으로 검증 + 좌석 계산 — Match 생성 로직은 엔진이 담당
  const engineRequest: SeatRequest = {
    id: request.id,
    trip_id: request.trip_id,
    operator_id: request.operator_id,
    region_id: request.region_id,
    requested_at: request.requested_at,
    status: "queued",
    seat_count: request.seat_count,
    passengers: (request.request_passengers ?? []).map((p) => ({
      id: p.id,
      request_id: request.id,
      name: p.name,
      phone: p.phone,
      priority: p.priority,
      school_or_role: p.school_or_role,
      note: p.note,
    })),
  };

  let result;
  try {
    result = approve(engineRequest, selectedPassengerIds, availableSeats);
  } catch (e) {
    if (e instanceof MatchingException) {
      return { error: MATCHING_ERROR_MESSAGE[e.code] ?? "매칭에 실패했습니다." };
    }
    throw e;
  }

  // Match 영속화 — payment_due_at는 DB NOT NULL(소프트 기한)
  const dueAt = new Date(Date.now() + PAYMENT_DUE_HOURS * 60 * 60 * 1000).toISOString();
  const { error: insertErr } = await db.from("matches").insert(
    result.matches.map((m) => ({
      trip_id: m.trip_id,
      request_id: m.request_id,
      passenger_id: m.passenger_id,
      status: "awaiting_payment" as const,
      payment_due_at: dueAt,
    })),
  );
  if (insertErr) return { error: "매칭 저장 중 오류가 발생했습니다." };

  // 신청의 전원이 매칭됐으면 status='matched' (부분 선택 시 queued 잔류 — 자동 분할 X)
  const totalPassengers = engineRequest.passengers.length;
  const { count: matchedCount } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId)
    .in("status", ["awaiting_payment", "payment_reported", "paid"]);

  if ((matchedCount ?? 0) >= totalPassengers) {
    await db.from("seat_requests").update({ status: "matched" }).eq("id", requestId);
  }

  revalidatePath(`/operator/trips/${tripId}`);
  return { ok: true };
}

// ─── 거절 (수동, 사유 필수) ───────────────────────────────────────────────────

export async function rejectRequest(
  tripId: string,
  requestId: string,
  reason: string,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const trimmed = reason.trim();
  if (trimmed.length < 10) return { error: "거절 사유를 10자 이상 입력해주세요." };
  if (trimmed.length > 500) return { error: "거절 사유는 500자 이하로 입력해주세요." };

  const db = createAdminClient();

  const trip = await loadOwnedTrip(db, tripId, session.regionId);
  if (!trip) return { error: "Trip을 찾을 수 없습니다." };

  const { data: request } = await db
    .from("seat_requests")
    .select("id, status")
    .eq("id", requestId)
    .eq("trip_id", tripId)
    .single();

  if (!request) return { error: "신청을 찾을 수 없습니다." };
  if (request.status !== "queued") return { error: "이미 처리된 신청입니다." };

  const { error: updateErr } = await db
    .from("seat_requests")
    .update({ status: "rejected", reject_reason: trimmed })
    .eq("id", requestId);
  if (updateErr) return { error: "거절 처리 중 오류가 발생했습니다." };

  // 거절 단순 로그 (V1, 임계값 X)
  await db.from("rejection_log").insert({
    seat_request_id: requestId,
    rejected_by: session.operatorId,
    reason: trimmed,
  });

  revalidatePath(`/operator/trips/${tripId}`);
  return { ok: true };
}

// ─── 매칭 후반 (공급 간사 — SPEC §S4·§7) ─────────────────────────────────────

/** matchId가 본인 지구 공급 trip 소속인지 확인. 통과 시 match(+passenger) 반환. */
async function loadOwnedMatch(
  db: ReturnType<typeof createAdminClient>,
  matchId: string,
  regionId: string,
) {
  const { data: match } = await db
    .from("matches")
    .select(
      `id, status, trip_id, passenger_id,
       trip:trips!trip_id(operator_region_id),
       request:seat_requests!request_id(operator_id),
       passenger:request_passengers!passenger_id(name, phone, school_or_role)`,
    )
    .eq("id", matchId)
    .single();
  if (!match) return null;
  const trip = firstOf(match.trip);
  if (!trip || trip.operator_region_id !== regionId) return null;
  return match;
}

/**
 * 입금 확인 → paid + 예약번호 발급 + 학생 검증 레코드(match_passengers) 생성 (SPEC §S4 step3).
 * awaiting_payment·payment_reported에서만. 상태 가드 UPDATE로 원자적(중복 발급 방지).
 */
export async function confirmPayment(matchId: string): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const db = createAdminClient();
  const match = await loadOwnedMatch(db, matchId, session.regionId);
  if (!match) return { error: "매칭을 찾을 수 없습니다." };
  if (match.status !== "awaiting_payment" && match.status !== "payment_reported") {
    return { error: "입금 확인할 수 있는 상태가 아닙니다." };
  }
  const pax = firstOf(match.passenger);
  if (!pax) return { error: "학생 정보를 찾을 수 없습니다." };

  // 예약번호 발급 + paid 전이 — unique 충돌 시 재생성, 0행이면 이미 처리됨
  let issuedCode: string | null = null;
  for (let i = 0; i < MAX_CODE_RETRIES; i += 1) {
    const code = generateReservationCode();
    const { data, error } = await db
      .from("matches")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        reservation_code: code,
      })
      .eq("id", matchId)
      .in("status", ["awaiting_payment", "payment_reported"])
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") continue; // reservation_code 충돌 → 재생성
      return { error: "입금 확인 중 오류가 발생했습니다." };
    }
    if (!data) return { error: "이미 처리된 매칭입니다." };
    issuedCode = code;
    break;
  }
  if (!issuedCode) return { error: "예약번호 발급에 실패했습니다. 다시 시도해주세요." };

  // 학생 검증 레코드(이름+전화 끝4자리로 /r 진입). 실패 시 paid 롤백.
  const { data: mpRow, error: mpErr } = await db
    .from("match_passengers")
    .insert({
      match_id: matchId,
      name: pax.name,
      phone: pax.phone,
      school_or_role: pax.school_or_role,
    })
    .select("id")
    .single();
  if (mpErr || !mpRow) {
    await db
      .from("matches")
      .update({ status: match.status, paid_at: null, reservation_code: null })
      .eq("id", matchId);
    return { error: "학생 정보 저장 중 오류가 발생했습니다." };
  }

  // 알림: 입금 확인 + 예약번호 → 신청 지구 간사 + 학생 (SPEC §S8). 실패해도 본 처리엔 영향 없음.
  try {
    await emit(
      "paid_code_issued",
      {
        requestOperatorId: firstOf(match.request)?.operator_id ?? null,
        passengerId: mpRow.id,
      },
      { matchId, reservationCode: issuedCode },
    );
  } catch {
    /* 알림 실패 무시 */
  }

  revalidatePath(`/operator/trips/${match.trip_id}`);
  revalidatePath("/operator/matches");
  return { ok: true };
}

/**
 * [자리 풀기] — 송금 지연 등 간사 수동 해제 (SPEC §7 release_seat).
 * awaiting_payment·payment_reported만 → expired. 자동 cron 아님. 자리 회수는 상태변경으로 자동.
 */
export async function releaseSeat(matchId: string): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const db = createAdminClient();
  const match = await loadOwnedMatch(db, matchId, session.regionId);
  if (!match) return { error: "매칭을 찾을 수 없습니다." };

  const { data, error } = await db
    .from("matches")
    .update({ status: "expired", cancellation_source: "operator" })
    .eq("id", matchId)
    .in("status", ["awaiting_payment", "payment_reported"])
    .select("id")
    .maybeSingle();
  if (error) return { error: "자리 풀기 중 오류가 발생했습니다." };
  if (!data) return { error: "이미 처리된 매칭입니다." };

  // 알림: 자리 풀림 → 신청 지구 (paid 전이라 학생 검증 레코드 없음 → passenger null). SPEC §S8.
  try {
    await emit(
      "seat_freed",
      {
        requestOperatorId: firstOf(match.request)?.operator_id ?? null,
        passengerId: null,
      },
      { tripId: match.trip_id },
    );
  } catch {
    /* 알림 실패 무시 */
  }

  revalidatePath(`/operator/trips/${match.trip_id}`);
  return { ok: true };
}

/**
 * [매칭 취소] — Phase 2 (송금 보고 후 미입금). SPEC §7 cancel_match(operator).
 * payment_reported에서만 (★ K1: paid는 공급측 취소 불가). 사유 필수.
 */
export async function cancelMatch(matchId: string, reason: string): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const trimmed = reason.trim();
  if (trimmed.length < 5) return { error: "취소 사유를 5자 이상 입력해주세요." };
  if (trimmed.length > 500) return { error: "취소 사유는 500자 이하로 입력해주세요." };

  const db = createAdminClient();
  const match = await loadOwnedMatch(db, matchId, session.regionId);
  if (!match) return { error: "매칭을 찾을 수 없습니다." };

  const { data, error } = await db
    .from("matches")
    .update({
      status: "cancelled",
      cancellation_source: "operator",
      cancellation_reason: trimmed,
    })
    .eq("id", matchId)
    .eq("status", "payment_reported") // 송금 보고 상태에서만 (paid 불가 = K1)
    .select("id")
    .maybeSingle();
  if (error) return { error: "매칭 취소 중 오류가 발생했습니다." };
  if (!data) {
    return { error: "송금 보고된 매칭만 취소할 수 있습니다 (입금 완료분은 취소 불가)." };
  }

  // 알림: 매칭 취소(Phase 2) → 신청 지구. SPEC §S8.
  try {
    await emit(
      "match_cancelled_p2",
      { requestOperatorId: firstOf(match.request)?.operator_id ?? null },
      { matchId, reason: trimmed },
    );
  } catch {
    /* 알림 실패 무시 */
  }

  revalidatePath(`/operator/trips/${match.trip_id}`);
  return { ok: true };
}
