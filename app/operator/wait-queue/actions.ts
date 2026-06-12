"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/notifications";
import { validateWaitAssignment } from "@/lib/wait-queue/validate";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | { ok: true };

/**
 * 대기 신청 → 버스 배정 (공급 간사) — 버스 미배정 대기큐의 신청을 본인 지구 공개 trip으로 이동.
 *   - 이동 = `trip_id` UPDATE 한 번. wait_*(지구·방향·희망일)는 이력으로 보존.
 *   - 이동 후 그 trip 상세 대기 큐(시간순 applied_at??requested_at)에 자동 합류 → 기존 승인 체인 진행.
 * 가드: 신청이 내 지구 대기큐 & queued & trip 미배정 / trip이 내 지구 & published & 방향 일치.
 * 상태 가드 UPDATE로 원자적 처리(동시 배정·거절·취소 레이스 방어).
 */
export async function assignWaitToTrip(
  requestId: string,
  tripId: string,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const db = createAdminClient();

  // 신청 가드(내 지구 대기큐 & queued & trip 미배정) + 차량 가드(내 지구 & published &
  // 방향 일치) — 판정은 순수 함수 validateWaitAssignment로(테스트 대상).
  const [{ data: request }, { data: trip }] = await Promise.all([
    db
      .from("seat_requests")
      .select("id, status, trip_id, wait_region_id, wait_direction, operator_id, student_id")
      .eq("id", requestId)
      .maybeSingle(),
    db
      .from("trips")
      .select("id, status, direction")
      .eq("id", tripId)
      .eq("operator_region_id", session.regionId)
      .maybeSingle(),
  ]);

  const check = validateWaitAssignment(request, trip, session.regionId);
  if (!check.ok) return { error: check.error };

  // 같은 학생의 동일 trip 중복 가드 — 학생 직접 신청(createStudentRequest)은 같은 trip에
  // 진행 중(queued/matched) 신청이 있으면 차단하는데, 대기 신청을 그 trip으로 배정하면 이
  // 가드를 우회해 한 학생이 같은 trip 큐에 2건 생김(이중 승인 → 활성 매칭·입금 요청 2배 위험).
  // 학생 신청(student_id 보유)에 한해 배정 전에 동일하게 차단한다.
  if (request?.student_id) {
    const { data: dup } = await db
      .from("seat_requests")
      .select("id")
      .eq("student_id", request.student_id)
      .eq("trip_id", tripId)
      .in("status", ["queued", "matched"])
      .limit(1);
    if (dup && dup.length > 0) {
      return {
        error:
          "이 학생은 해당 차량에 이미 진행 중인 신청이 있어요. 차량 상세 대기 큐에서 기존 신청을 먼저 확인해주세요.",
      };
    }
  }

  // 상태 가드 UPDATE — queued & 미배정인 동안에만 trip_id 부여(원자적, 중복 배정 방지).
  const { data: updated } = await db
    .from("seat_requests")
    .update({ trip_id: tripId })
    .eq("id", requestId)
    .eq("status", "queued")
    .is("trip_id", null)
    .select("id")
    .maybeSingle();
  if (!updated) {
    return { error: "이미 처리된 신청입니다. 새로고침 후 확인해주세요." };
  }

  // 알림: 버스 배정 → 수요측 신청 주체 (베스트에포트 — 실패가 배정을 되돌리지 않음).
  // operator 신청이면 그 지구 fan-out(emit 기존 정책). 학생 직접 신청은 operator_id가 null이라
  // resolveTargets가 자동 제외(연결 가능한 match_passengers 없음) — 학생은 /s 화면에서 확인.
  try {
    await emit(
      "wait_assigned",
      { requestOperatorId: request?.operator_id ?? null, passengerId: null },
      { requestId, tripId },
    );
  } catch {
    /* 알림 실패 무시 */
  }

  revalidatePath("/operator/wait-queue");
  revalidatePath(`/operator/trips/${tripId}`);
  revalidatePath("/operator");
  revalidatePath("/operator/requests");
  revalidatePath("/status");
  return { ok: true };
}

/**
 * 대기 신청 거절 (공급 간사) — 버스 미배정 대기큐의 신청을 rejected로 마감.
 * 권한 = wait_region_id 본인 지구. 사유는 선택(빈 값 허용 — trip 큐의 전체 거절과 달리
 * '버스를 못 올리는' 사정 거절이 대부분이라 강제하지 않음). 알림·로그는 기존 거절 패턴 재사용.
 */
export async function rejectWaitRequest(
  requestId: string,
  reason?: string,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const trimmed = (reason ?? "").trim();
  if (trimmed.length > 500) return { error: "거절 사유는 500자 이하로 입력해주세요." };

  const db = createAdminClient();

  // 신청 가드 — 내 지구 대기큐 소속 + 아직 미배정 대기(queued & trip_id null).
  const { data: request } = await db
    .from("seat_requests")
    .select("id, status, trip_id, wait_region_id, operator_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!request || request.wait_region_id !== session.regionId) {
    return { error: "대기 신청을 찾을 수 없습니다." };
  }
  if (request.trip_id !== null) {
    return { error: "이미 버스가 배정된 신청입니다. 차량 상세의 대기 큐에서 처리해주세요." };
  }
  if (request.status !== "queued") {
    return { error: "이미 처리된 신청입니다." };
  }

  const closingReason = trimmed || "버스 배정이 어려워 대기 신청이 거절되었습니다.";

  // 상태 가드 UPDATE — queued & 미배정인 동안에만 rejected 전이(원자적, 동시 배정 레이스 방어).
  const { data: updated } = await db
    .from("seat_requests")
    .update({ status: "rejected", reject_reason: closingReason })
    .eq("id", requestId)
    .eq("status", "queued")
    .is("trip_id", null)
    .select("id")
    .maybeSingle();
  if (!updated) {
    return { error: "이미 처리된 신청입니다. 새로고침 후 확인해주세요." };
  }

  // 거절 단순 로그 (trip 큐 거절과 동일 — V1, 임계값 X)
  await db.from("rejection_log").insert({
    seat_request_id: requestId,
    rejected_by: session.operatorId,
    reason: closingReason,
  });

  // 알림: 거절+사유 → 신청 지구 간사 / 거절 발생 → 마스터 (기존 거절 패턴 재사용).
  // 학생 직접 신청은 operator_id null → 자동 제외(학생은 /s 화면에서 거절 사유 확인).
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

  revalidatePath("/operator/wait-queue");
  revalidatePath("/operator");
  revalidatePath("/operator/requests");
  revalidatePath("/status");
  return { ok: true };
}
