"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReservationCode } from "@/lib/reservation/code";
import { emit } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | { ok: true };

// 송금 기한 = 매칭 후 24h (v1.1 소프트 — 자동 만료 아님, 리마인더 기준일 뿐. SPEC §7)
const PAYMENT_DUE_HOURS = 24;
// 예약번호 unique 충돌 시 재생성 횟수
const MAX_CODE_RETRIES = 5;
// 매칭으로 자리를 점유하는 상태 (이게 하나라도 있으면 차량 취소 불가)
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

function firstOf<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

// approve_request_atomic() RPC가 RAISE EXCEPTION 한 코드 → 사용자 메시지.
const APPROVE_ERROR_FALLBACK = "매칭에 실패했습니다. 새로고침 후 다시 시도해주세요.";
const APPROVE_ERROR_MESSAGE: Record<string, string> = {
  NO_PASSENGERS: "승인할 학생을 선택해주세요.",
  TRIP_NOT_PUBLISHED: "공개 상태의 Trip만 매칭할 수 있습니다.",
  REQUEST_NOT_QUEUED: "이미 처리된 신청입니다. 새로고침 후 다시 확인해주세요.",
  PASSENGER_MISMATCH: "신청에 없는 학생이 포함됐습니다. 새로고침 후 다시 시도해주세요.",
  ALREADY_MATCHED: "이미 매칭된 학생이 포함되어 있습니다. 새로고침 후 다시 시도해주세요.",
  OVER_CAPACITY: "잔여 좌석이 부족합니다. 새로고침 후 잔여 좌석을 다시 확인해주세요.",
};
function approveErrorMessage(msg: string): string {
  const code = Object.keys(APPROVE_ERROR_MESSAGE).find((c) => msg.includes(c));
  return code ? APPROVE_ERROR_MESSAGE[code] : APPROVE_ERROR_FALLBACK;
}

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

// ─── 승인 (선택 학생 → Match 생성, 원자적 RPC) ──────────────────────────────

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

  // 신청 메타 (queued 확인 + 알림 수신 지구). 좌석 검증·매칭 삽입은 아래 원자 RPC가 담당.
  // operator_id는 학생 직접 신청이면 null → 아래 emit의 requestOperatorId가 null이 되어
  // resolveTargets가 그 대상을 자동 제외(학생 알림 best-effort 스킵). 학생은 /s 화면에서 상태 확인.
  const { data: request } = await db
    .from("seat_requests")
    .select("id, operator_id, status")
    .eq("id", requestId)
    .eq("trip_id", tripId)
    .single();

  if (!request) return { error: "신청을 찾을 수 없습니다." };
  if (request.status !== "queued") return { error: "이미 처리된 신청입니다." };
  if (selectedPassengerIds.length === 0) {
    return { error: "승인할 학생을 선택해주세요." };
  }

  // 원자적 승인 — seat_offers 행 잠금 + 잔여 재검증 + 매칭 삽입.
  // 동시 승인(over-booking)·이중 매칭을 DB 트랜잭션/제약으로 차단 (SPEC §S3, race 방지).
  const dueAt = new Date(Date.now() + PAYMENT_DUE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: matchIds, error: rpcErr } = await db.rpc("approve_request_atomic", {
    p_trip_id: tripId,
    p_request_id: requestId,
    p_passenger_ids: selectedPassengerIds,
    p_payment_due_at: dueAt,
  });
  if (rpcErr) return { error: approveErrorMessage(rpcErr.message) };

  // 알림: 매칭 확정 → 신청 지구 간사. 부분 매칭(남은 학생 있음)이면 양쪽에 추가 통지.
  // 실패해도 본 처리엔 영향 없음(best-effort).
  const confirmedMatchId = matchIds?.[0];
  if (confirmedMatchId) {
    try {
      await emit(
        "match_confirmed",
        { requestOperatorId: request.operator_id },
        { matchId: confirmedMatchId, tripId },
      );
      // 부분 매칭 여부 = 신청 총원 > 이번에 승인한 인원 (RPC가 전원 매칭 시에만 'matched' 처리)
      const { count: totalPax } = await db
        .from("request_passengers")
        .select("id", { count: "exact", head: true })
        .eq("request_id", requestId);
      if ((totalPax ?? 0) > selectedPassengerIds.length) {
        await emit(
          "partial_match",
          {
            supplyOperatorId: session.operatorId,
            requestOperatorId: request.operator_id,
          },
          {
            matchId: confirmedMatchId,
            requestId,
            seatCount: selectedPassengerIds.length,
          },
        );
      }
    } catch {
      /* 알림 실패 무시 */
    }
  }

  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/status");
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

  // operator_id는 학생 직접 신청이면 null → 아래 거절 알림의 requestOperatorId가 null이 되어
  // resolveTargets가 자동 제외(학생 알림 best-effort 스킵). 학생은 /s 화면에서 거절 사유 확인.
  const { data: request } = await db
    .from("seat_requests")
    .select("id, status, operator_id")
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

  // 알림: 거절+사유 → 신청 지구 간사 / 거절 발생 → 마스터 (SPEC §S8). 실패해도 본 처리 영향 없음.
  try {
    await emit(
      "match_rejected",
      { requestOperatorId: request.operator_id },
      { requestId, reason: trimmed },
    );
    await emit("rejection_occurred", { master: true }, { requestId, reason: trimmed });
  } catch {
    /* 알림 실패 무시 */
  }

  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/status");
  return { ok: true };
}

// ─── 선택 학생 거절 (공급 간사 — 체크한 학생만 제거, 사용자 요청 2026-06-10) ──────────
/**
 * 대기 신청에서 '선택한 학생'만 거절한다(나머지는 대기 유지).
 *   - 선택 학생을 request_passengers.declined_at 으로 표시(기록 보존, 큐 표시에서만 제외).
 *   - 거절 후 남은 활성 학생(declined_at null)이 0이면 신청 전체를 rejected 로 마감
 *     (= 전원 거절과 동일 결과: 거절 로그 + match_rejected/rejection_occurred 알림).
 *   - 남은 학생이 있으면 신청은 queued 유지 + 신청 지구에 'passengers_declined' 안내.
 * 전체 거절(아무도 선택 안 함)은 기존 rejectRequest 를 사용한다.
 */
export async function declinePassengers(
  tripId: string,
  requestId: string,
  passengerIds: string[],
  reason: string,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  if (passengerIds.length === 0) return { error: "거절할 학생을 선택해주세요." };
  const trimmed = reason.trim();
  if (trimmed.length > 500) return { error: "사유는 500자 이하로 입력해주세요." };

  const db = createAdminClient();

  const trip = await loadOwnedTrip(db, tripId, session.regionId);
  if (!trip) return { error: "Trip을 찾을 수 없습니다." };

  // 신청 메타 — queued 확인 + 알림 대상(신청 지구 간사). 학생 직접 신청이면 operator_id null.
  const { data: request } = await db
    .from("seat_requests")
    .select("id, operator_id, status")
    .eq("id", requestId)
    .eq("trip_id", tripId)
    .single();
  if (!request) return { error: "신청을 찾을 수 없습니다." };
  if (request.status !== "queued") return { error: "이미 처리된 신청입니다." };

  // 선택 학생이 이 신청 소속 + 아직 활성(미거절)인지 확인 (FormData 위조·중복 처리 방어).
  const { data: targets } = await db
    .from("request_passengers")
    .select("id")
    .eq("request_id", requestId)
    .in("id", passengerIds)
    .is("declined_at", null);
  const targetIds = (targets ?? []).map((p) => p.id);
  if (targetIds.length === 0) {
    return { error: "이미 처리된 학생입니다. 새로고침 후 다시 시도해주세요." };
  }

  // 선택 학생 거절 표시 (기록 보존, 큐 표시에서만 제외).
  const { error: declineErr } = await db
    .from("request_passengers")
    .update({ declined_at: new Date().toISOString(), decline_reason: trimmed || null })
    .in("id", targetIds);
  if (declineErr) return { error: "거절 처리 중 오류가 발생했습니다." };

  // 남은 활성 학생(declined_at null) 수. 0이면 신청에 남은 사람이 없으니 전체 마감.
  // (매칭된 학생은 declined_at null로 남아 카운트됨 → 신청을 닫지 않음: 매칭은 그대로 유지.)
  const { count: remainingActive } = await db
    .from("request_passengers")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId)
    .is("declined_at", null);

  if ((remainingActive ?? 0) === 0) {
    // 남은 학생 없음 → 신청 통째 마감 (전원 거절과 동일 결과).
    const closingReason = trimmed || "신청 학생 전원 거절";
    await db
      .from("seat_requests")
      .update({ status: "rejected", reject_reason: closingReason })
      .eq("id", requestId)
      .eq("status", "queued");
    await db.from("rejection_log").insert({
      seat_request_id: requestId,
      rejected_by: session.operatorId,
      reason: closingReason,
    });
    try {
      await emit(
        "match_rejected",
        { requestOperatorId: request.operator_id },
        { requestId, reason: closingReason },
      );
      await emit("rejection_occurred", { master: true }, { requestId, reason: closingReason });
    } catch {
      /* 알림 실패 무시 */
    }
  } else {
    // 일부만 거절 — 남은 학생 대기 유지. 신청 지구에 '일부 제외' 안내(학생 직접 신청이면 skip).
    try {
      await emit(
        "passengers_declined",
        { requestOperatorId: request.operator_id },
        { requestId, declinedCount: targetIds.length, reason: trimmed || undefined },
      );
    } catch {
      /* 알림 실패 무시 */
    }
  }

  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/status");
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
 * 매칭이 풀린(해제·취소) 뒤, 그 신청을 다시 대기열(queued)로 되돌린다.
 *   '전원 매칭'이 아니게 됐으니 신청 지구 화면에 '매칭됨'이 잘못 남지 않게 함(이미 queued/거절/취소면 무시).
 *   request_id는 별도 스칼라 조회로 얻는다(loadOwnedMatch의 임베드와 같은 FK라 한 select에 합치면
 *   타입드 클라이언트에서 결과가 비어 매칭을 못 찾는 문제 → 분리).
 */
async function requeueRequestOfMatch(
  db: ReturnType<typeof createAdminClient>,
  matchId: string,
): Promise<void> {
  const { data: link } = await db
    .from("matches")
    .select("request_id")
    .eq("id", matchId)
    .maybeSingle();
  const requestId = link?.request_id;
  if (!requestId) return;
  await db
    .from("seat_requests")
    .update({ status: "queued" })
    .eq("id", requestId)
    .eq("status", "matched");
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
 * [매칭 취소] — 송금 지연·오승인 등으로 간사가 매칭을 취소하고 좌석을 다시 비운다
 * (구 '자리 풀기/매칭 해제' · SPEC §7 release_seat). awaiting_payment·payment_reported만 → expired.
 * 신청 지구는 다시 대기열(queued)로 되돌려 '매칭됨'이 잘못 남지 않게 한다(재매칭 가능).
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
  if (error) return { error: "매칭 취소 중 오류가 발생했습니다." };
  if (!data) return { error: "이미 처리된 매칭입니다." };

  // ★ 신청 상태 되돌리기 — 매칭이 풀렸으니 신청은 더 이상 '전원 매칭'이 아님.
  //   신청 지구 화면에 '매칭됨'이 잘못 남는 버그 방지(이미 queued/거절/취소면 건드리지 않음).
  await requeueRequestOfMatch(db, matchId);

  // 알림: 매칭 취소 → 신청 지구 (paid 전이라 학생 검증 레코드 없음 → passenger null). SPEC §S8.
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
  revalidatePath("/status");
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

  // ★ 신청 상태 되돌리기 — 매칭 취소로 더 이상 '전원 매칭'이 아님(요청 화면 '매칭됨' 잔존 방지).
  await requeueRequestOfMatch(db, matchId);

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
  revalidatePath("/status");
  return { ok: true };
}

// ─── 잔여 좌석(타지구 공개 좌석) 변경 — 공급 간사 (UI 라벨: '잔여 좌석 변경') ─────
/**
 * 타지구에 내놓는 좌석 수(seat_offers.seat_count)를 조정한다.
 *   예: 15석 공개 → 7명 타지구 확정 → 본인 지구용 3석 확보 위해 12로 축소.
 * 가드: draft/published 차량만. 이미 매칭(자리 점유)된 인원 미만으로는 못 줄이고, 정원 초과 불가.
 * 확정 인원수 자체는 못 바꾼다(매칭은 그대로) — 내놓는 좌석 한도만 조정.
 */
export async function editSeatOffer(
  tripId: string,
  newCount: number,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  if (!Number.isInteger(newCount) || newCount < 1) {
    return { error: "잔여 좌석은 1석 이상이어야 합니다." };
  }

  const db = createAdminClient();

  const { data: trip } = await db
    .from("trips")
    .select("id, status, capacity")
    .eq("id", tripId)
    .eq("operator_region_id", session.regionId)
    .single();
  if (!trip) return { error: "차량을 찾을 수 없습니다." };
  if (trip.status !== "draft" && trip.status !== "published") {
    return { error: "공개·임시저장 상태의 차량만 인원을 변경할 수 있습니다." };
  }
  // 공개 인원은 정원(버스 좌석 수) 이하만. 정원은 바뀌지 않는다 — 공개 인원만 조정한다.
  if (newCount > trip.capacity) {
    return { error: `정원(${trip.capacity}석)을 초과할 수 없습니다.` };
  }

  // 이미 매칭(자리 점유)된 인원보다 적게 줄일 수 없음.
  const { count: activeCount } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId)
    .in("status", [...ACTIVE_MATCH_STATUSES]);
  const matched = activeCount ?? 0;
  if (newCount < matched) {
    return {
      error: `이미 매칭된 ${matched}명보다 적게 줄일 수 없습니다. (매칭을 먼저 정리하세요)`,
    };
  }

  // 공개(open) 좌석 공급 행 갱신. (V1: trip당 open offer 1개)
  const { data: offer } = await db
    .from("seat_offers")
    .select("id")
    .eq("trip_id", tripId)
    .eq("status", "open")
    .maybeSingle();
  if (!offer) return { error: "공개된 좌석 정보가 없습니다." };

  const { error: updErr } = await db
    .from("seat_offers")
    .update({ seat_count: newCount })
    .eq("id", offer.id);
  if (updErr) return { error: "인원 변경 중 오류가 발생했습니다." };

  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/operator/trips");
  revalidatePath("/status");
  return { ok: true };
}

// ─── 차량(Trip) 취소 — 공급 간사 (사용자 요청 2026-06-07) ─────────────────────
/**
 * 공개/임시 차량을 취소한다. **활성 매칭(자리 점유)이 하나도 없을 때만** 가능.
 *   - 매칭이 있었다가 전부 해제/취소돼 활성 0이 되면 다시 취소 가능.
 *   - 취소 시: status='cancelled' + 좌석 공급 마감 + 대기(queued) 신청 취소 + 신청 지구에 재신청 추천.
 * 사유는 선택(빈 값 허용). draft/published 에서만(closed·cancelled는 불가).
 */
export async function cancelTrip(
  tripId: string,
  reason: string,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const trimmed = reason.trim();
  if (trimmed.length > 500) return { error: "취소 사유는 500자 이하로 입력해주세요." };

  const db = createAdminClient();
  const trip = await loadOwnedTrip(db, tripId, session.regionId);
  if (!trip) return { error: "차량을 찾을 수 없습니다." };
  if (trip.status !== "draft" && trip.status !== "published") {
    return { error: "공개·임시저장 상태의 차량만 취소할 수 있습니다." };
  }

  // 활성 매칭(자리 점유)이 하나라도 있으면 취소 불가.
  const { data: pre } = await db
    .from("matches")
    .select("id")
    .eq("trip_id", tripId)
    .in("status", [...ACTIVE_MATCH_STATUSES])
    .limit(1);
  if (pre && pre.length > 0) {
    return {
      error:
        "매칭된(자리 점유) 학생이 있어 취소할 수 없습니다. 먼저 학생들의 매칭을 취소한 뒤 다시 시도해주세요.",
    };
  }

  // 상태 가드 UPDATE로 취소를 선점 — 그 사이 매칭/상태가 바뀌었으면 0행 → 중단.
  const { data: claimed } = await db
    .from("trips")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: trimmed || null,
    })
    .eq("id", tripId)
    .eq("operator_region_id", session.regionId)
    .in("status", ["draft", "published"])
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return { error: "취소할 수 없는 상태입니다. 새로고침 후 다시 확인해주세요." };
  }

  // 선점 후 재확인 — 윈도우 사이 승인이 들어와 활성 매칭이 생겼으면 되돌리고 중단(race 가드).
  const { data: race } = await db
    .from("matches")
    .select("id")
    .eq("trip_id", tripId)
    .in("status", [...ACTIVE_MATCH_STATUSES])
    .limit(1);
  if (race && race.length > 0) {
    await db
      .from("trips")
      .update({
        status: trip.status,
        cancelled_at: null,
        cancellation_reason: null,
      })
      .eq("id", tripId);
    return {
      error: "방금 매칭이 진행되어 취소할 수 없습니다. 새로고침 후 확인해주세요.",
    };
  }

  // 좌석 공급 마감(더 이상 매칭 대상 아님).
  await db.from("seat_offers").update({ status: "closed" }).eq("trip_id", tripId);

  // 대기(queued) 신청 취소 + 신청 지구 간사에게 재신청 추천 알림(다른 차량 찾도록).
  const { data: queued } = await db
    .from("seat_requests")
    .select("id, operator_id")
    .eq("trip_id", tripId)
    .eq("status", "queued");
  const queuedIds = (queued ?? []).map((r) => r.id);
  if (queuedIds.length > 0) {
    await db
      .from("seat_requests")
      .update({ status: "cancelled" })
      .in("id", queuedIds);
    const operatorIds = [
      ...new Set((queued ?? []).map((r) => r.operator_id).filter(Boolean)),
    ] as string[];
    if (operatorIds.length > 0) {
      try {
        await emit(
          "reapply_recommended",
          { requestOperatorIds: operatorIds },
          { tripId },
        );
      } catch {
        /* 알림 실패 무시 */
      }
    }
  }

  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/operator/trips");
  revalidatePath("/status");
  return { ok: true };
}
