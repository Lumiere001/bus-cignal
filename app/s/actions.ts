"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStudent, clearStudentSession } from "@/lib/auth/student";
import { clearPassengerSession } from "@/lib/auth/passenger";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit, NOTIFICATION_EVENTS } from "@/lib/notifications";
import { isMaintenanceMode, isPastRequestDeadline } from "@/lib/system-config";

/**
 * 학생 직접 신청 서버 액션 (CCC 로그인 학생). docs/STUDENT-PHASE-2-3-SPEC §2-3.
 *
 * 간사 신청(app/operator/requests/actions.ts)과 같은 가드를 따르되, 주체가 **학생 본인 1명**이다:
 *  - 명단은 CCC에서 온 본인 정보로 서버가 채운다(클라이언트 입력 신뢰 안 함).
 *  - seat_requests.requester_kind='student' + student_id (operator_id·consent_confirmed_by는 null).
 *  - 기존 간사·예약번호(/r) 흐름은 건드리지 않는다.
 */

// createStudentRequest는 성공 시 redirect("/s")로 빠져나가므로 정상 반환값은 실패(에러)뿐.
type CreateResult = { error: string } | undefined;
// cancelStudentRequest는 성공/실패를 클라이언트가 분기(성공 시 새로고침).
type MutationResult = { error: string } | { ok: true };

// 매칭으로 자리를 점유하는 상태 — 잔여 좌석 계산 시 차감(차량 상세 page.tsx와 동일 기준).
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/**
 * 차량 1건에 본인 직접 신청. 성공 시 /s 로 redirect, 실패 시 { error } 반환.
 * @param tripId 신청할 공급 차량
 * @param consent 개인정보 수집·이용 동의 여부
 */
export async function createStudentRequest(
  tripId: string,
  consent: boolean,
): Promise<CreateResult> {
  const session = await requireStudent();

  // 출신 지구는 신청 주체 식별·정산 단위라 필수. 미매핑이면 신청 불가(로그인 자체는 허용됨 — Phase 1).
  if (!session.regionId) {
    return {
      error:
        "출신 지구가 확인되지 않았어요. 담당 간사에게 지구(branch) 등록을 요청해 주세요.",
    };
  }

  // UI 차단을 우회한 직접 호출도 서버에서 방어 (간사 신청과 동일 가드).
  if (await isMaintenanceMode()) {
    return { error: "시스템 점검 중입니다. 잠시 후 다시 시도해주세요." };
  }
  if (await isPastRequestDeadline()) {
    return { error: "신청이 마감되었습니다. (마감일 이후에는 신청할 수 없습니다.)" };
  }
  if (!consent) {
    return { error: "개인정보 수집·이용 동의가 필요합니다." };
  }

  const db = createAdminClient();

  // 본인 명단 = CCC 제공 정보. 클라이언트가 보낸 이름·전화를 받지 않는다(위조 방지).
  const { data: student } = await db
    .from("students")
    .select("name, phone, campus")
    .eq("id", session.studentId)
    .maybeSingle();
  const name = (student?.name ?? "").trim();
  const phone = cleanPhone(student?.phone ?? "");
  if (!name || phone.length < 10 || phone.length > 11) {
    return {
      error:
        "이름·전화번호 정보가 없어 신청할 수 없어요. CCC 계정 정보를 확인한 뒤 다시 로그인해 주세요.",
    };
  }

  // 타지구 공개 차량만 — published + 잔여>0. (draft/closed/cancelled 불가)
  const { data: trip } = await db
    .from("trips")
    .select("id, status, created_by, seat_offers(seat_count, status), matches(id, status)")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { error: "차량을 찾을 수 없습니다." };
  if (trip.status !== "published") {
    return { error: "공개 중인 차량에만 신청할 수 있습니다." };
  }

  const openSeats = (trip.seat_offers ?? [])
    .filter((o) => o.status === "open")
    .reduce((sum, o) => sum + o.seat_count, 0);
  const activeMatches = (trip.matches ?? []).filter((m) =>
    (ACTIVE_MATCH_STATUSES as readonly string[]).includes(m.status ?? ""),
  ).length;
  const available = Math.max(0, openSeats - activeMatches);
  if (available < 1) {
    return { error: "잔여 좌석이 없습니다. 다른 차량을 확인해 주세요." };
  }

  // 동일 차량 중복 신청 방지 — 진행 중(queued/matched) 신청이 이미 있으면 차단.
  const { data: dup } = await db
    .from("seat_requests")
    .select("id")
    .eq("student_id", session.studentId)
    .eq("trip_id", tripId)
    .in("status", ["queued", "matched"])
    .limit(1);
  if (dup && dup.length > 0) {
    return { error: "이미 신청한 차량이에요. ‘내 신청’에서 확인해 주세요." };
  }

  // seat_request 생성 (status=queued, 동의 시각 기록). 주체=학생 → operator_id/consent_confirmed_by null.
  const { data: request, error: reqErr } = await db
    .from("seat_requests")
    .insert({
      trip_id: tripId,
      region_id: session.regionId,
      requester_kind: "student",
      student_id: session.studentId,
      seat_count: 1,
      status: "queued",
      consent_confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (reqErr || !request) return { error: "신청 저장 중 오류가 발생했습니다." };

  // 본인 1명 명단 — 실패 시 신청 롤백(고아 seat_request 방지). campus=학교 참고용.
  const { error: paxErr } = await db.from("request_passengers").insert({
    request_id: request.id,
    name,
    phone,
    school_or_role: (student?.campus ?? "").trim() || null,
    priority: 1,
  });
  if (paxErr) {
    await db.from("seat_requests").delete().eq("id", request.id);
    return { error: "학생 정보 저장 중 오류가 발생했습니다." };
  }

  // 공급 지구 간사에게 "신규 신청" 알림 (간사 신청과 동일 — best-effort). 알림 실패가 신청을 되돌리지 않음.
  try {
    await emit(
      NOTIFICATION_EVENTS.REQUEST_NEW,
      { supplyOperatorId: trip.created_by },
      { requestId: request.id, tripId, seatCount: 1 },
    );
  } catch {
    /* 알림 실패 무시 (신청은 이미 저장됨) */
  }

  revalidatePath("/s");
  redirect("/s");
}

/**
 * 본인 신청 취소 — 본인(student_id 일치) + 대기(queued) 만. 상태 가드 UPDATE로 원자적 처리.
 */
export async function cancelStudentRequest(
  requestId: string,
): Promise<MutationResult> {
  const session = await requireStudent();
  const db = createAdminClient();

  const { data: req } = await db
    .from("seat_requests")
    .select("id, student_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.student_id !== session.studentId) {
    return { error: "신청을 찾을 수 없습니다." };
  }
  if (req.status !== "queued") {
    return { error: "대기 중인 신청만 취소할 수 있어요." };
  }

  // 진행 중 매칭 방어 — queued면 없어야 하지만, 레이스로 막 매칭됐으면 취소 불가.
  const { data: active } = await db
    .from("matches")
    .select("id")
    .eq("request_id", requestId)
    .in("status", [...ACTIVE_MATCH_STATUSES])
    .limit(1);
  if (active && active.length > 0) {
    return { error: "방금 매칭이 진행되어 취소할 수 없어요. 새로고침 후 확인해 주세요." };
  }

  const { data: updated } = await db
    .from("seat_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!updated) return { error: "이미 처리된 신청입니다." };

  revalidatePath("/s");
  return { ok: true };
}

/** 학생 로그아웃 → 학생 로그인 안내로. ("예약 확인" 브리지로 발급된 passenger 세션도 함께 정리.) */
export async function studentLogout(): Promise<void> {
  await clearStudentSession();
  await clearPassengerSession();
  redirect("/s/login");
}
