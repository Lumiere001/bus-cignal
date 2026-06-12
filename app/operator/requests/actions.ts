"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  emit,
  NOTIFICATION_EVENTS,
  approvedOperatorIdsForRegions,
} from "@/lib/notifications";
import {
  isWaitDirection,
  validateDesiredDate,
  validateOperatorWaitRegion,
} from "@/lib/wait-queue/validate";
import { isMaintenanceMode, isPastRequestDeadline } from "@/lib/system-config";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | undefined;

// 클라이언트에서 넘어오는 학생 1명 (priority는 서버에서 행 순서로 재부여 → 위조·중복 방지)
export type PassengerInput = {
  name: string;
  phone: string;
  schoolOrRole: string;
  note: string;
};

const MAX_PASSENGERS = 45; // 버스 정원 상한과 동일 맥락 (정원=200까지지만 단일 신청은 현실적 상한)

function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

// 서버에서 정규화된 학생 1명 (priority는 행 순서대로 1..N — DB unique(request_id, priority) 충족)
type NormalizedPassenger = {
  name: string;
  phone: string;
  school_or_role: string | null;
  note: string | null;
  priority: number;
};

/**
 * 학생 명단 검증 + 정규화 — createRequest·updateRequest 공용(규칙 drift 방지).
 * 성공 시 normalized 배열, 실패 시 { error } 반환. priority는 입력 순서대로 1..N 부여.
 */
function validatePassengers(
  passengers: PassengerInput[],
): { ok: true; normalized: NormalizedPassenger[] } | { ok: false; error: string } {
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return { ok: false, error: "학생을 1명 이상 입력해주세요." };
  }
  if (passengers.length > MAX_PASSENGERS) {
    return { ok: false, error: `한 번에 최대 ${MAX_PASSENGERS}명까지 신청할 수 있습니다.` };
  }

  const normalized: NormalizedPassenger[] = passengers.map((p, i) => ({
    name: (p.name ?? "").trim(),
    phone: cleanPhone(p.phone ?? ""),
    school_or_role: (p.schoolOrRole ?? "").trim() || null,
    note: (p.note ?? "").trim() || null,
    priority: i + 1,
  }));

  for (const p of normalized) {
    if (p.name.length < 1 || p.name.length > 50) {
      return { ok: false, error: "학생 이름을 1~50자로 입력해주세요." };
    }
    if (p.phone.length < 10 || p.phone.length > 11) {
      return { ok: false, error: `전화번호를 올바르게 입력해주세요. (${p.name})` };
    }
    if (p.school_or_role && p.school_or_role.length > 100) {
      return { ok: false, error: "학교/역할은 100자 이하로 입력해주세요." };
    }
    if (p.note && p.note.length > 200) {
      return { ok: false, error: "메모는 200자 이하로 입력해주세요." };
    }
  }

  return { ok: true, normalized };
}

export async function createRequest(
  tripId: string,
  passengers: PassengerInput[],
  consent: boolean,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  // 점검 모드·신청 마감 차단(마스터 설정) — UI 차단 우회한 직접 호출도 서버에서 방어.
  if (await isMaintenanceMode()) {
    return { error: "시스템 점검 중입니다. 잠시 후 다시 시도해주세요." };
  }
  if (await isPastRequestDeadline()) {
    return { error: "신청이 마감되었습니다. (마감일 이후에는 신청할 수 없습니다.)" };
  }

  if (!consent) {
    return { error: "개인정보 수집·이용 동의가 필요합니다." };
  }

  const validated = validatePassengers(passengers);
  if (!validated.ok) return { error: validated.error };
  const normalized = validated.normalized;

  const db = createAdminClient();

  // 타지구 공개 trip만 신청 가능 — 본인 지구 trip엔 신청 불가, draft/closed 불가
  const { data: trip } = await db
    .from("trips")
    .select("id, status, operator_region_id, created_by")
    .eq("id", tripId)
    .single();

  if (!trip) return { error: "차량을 찾을 수 없습니다." };
  if (trip.status !== "published") {
    return { error: "공개 중인 차량에만 신청할 수 있습니다." };
  }
  if (trip.operator_region_id === session.regionId) {
    return { error: "본인 지구 차량에는 신청할 수 없습니다." };
  }

  // seat_request 생성 (status=queued, 동의 시각·주체 기록)
  const { data: request, error: reqErr } = await db
    .from("seat_requests")
    .insert({
      trip_id: tripId,
      region_id: session.regionId,
      operator_id: session.operatorId,
      seat_count: normalized.length,
      status: "queued",
      consent_confirmed_at: new Date().toISOString(),
      consent_confirmed_by: session.operatorId,
    })
    .select("id")
    .single();

  if (reqErr || !request) return { error: "신청 저장 중 오류가 발생했습니다." };

  // 학생 명단 — 실패 시 신청 롤백 (고아 seat_request 방지)
  const { error: paxErr } = await db.from("request_passengers").insert(
    normalized.map((p) => ({
      request_id: request.id,
      name: p.name,
      phone: p.phone,
      school_or_role: p.school_or_role,
      note: p.note,
      priority: p.priority,
    })),
  );

  if (paxErr) {
    await db.from("seat_requests").delete().eq("id", request.id);
    return { error: "학생 명단 저장 중 오류가 발생했습니다." };
  }

  // 공급 지구 간사에게 "신규 신청" 알림 (SPEC §S2.6). 베스트에포트 — 알림 실패가
  // 신청 저장을 되돌리지 않음. supplyOperatorId는 호출자가 해석(엔진은 id만 받음).
  try {
    await emit(
      NOTIFICATION_EVENTS.REQUEST_NEW,
      { supplyOperatorId: trip.created_by },
      { requestId: request.id, tripId, seatCount: normalized.length },
    );
  } catch {
    // 알림 발송 실패는 무시 (신청은 이미 저장됨)
  }

  revalidatePath("/status");
  redirect("/operator/requests");
}

// 버스 미배정 대기 신청 입력 — trip 대신 대상(공급) 지구 + 방향(+희망일 선택)으로 신청.
export type WaitRequestInput = {
  /** 대기큐 대상(공급) 지구 — 아직 버스를 올리지 않은 타지구 */
  waitRegionId: string;
  /** 가는편(up)/오는편(down) */
  direction: "up" | "down";
  /** 희망 출발일 YYYY-MM-DD (선택 — 없으면 null) */
  desiredDate: string | null;
  passengers: PassengerInput[];
  consent: boolean;
};

/**
 * 버스 미배정 대기 신청 (간사) — 대상 지구가 버스를 안 올렸을 때 trip 없이(trip_id=null)
 * 그 지구 대기큐에 신청을 걸어둔다. 버스가 생기면 공급 간사가 수동으로 trip에 배정.
 * 명단 검증·insert·롤백 흐름은 createRequest와 동일(validatePassengers 공용).
 */
export async function createWaitRequest(
  input: WaitRequestInput,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  // 점검 모드·신청 마감 차단(마스터 설정) — createRequest와 동일 가드.
  if (await isMaintenanceMode()) {
    return { error: "시스템 점검 중입니다. 잠시 후 다시 시도해주세요." };
  }
  if (await isPastRequestDeadline()) {
    return { error: "신청이 마감되었습니다. (마감일 이후에는 신청할 수 없습니다.)" };
  }

  if (!input.consent) {
    return { error: "개인정보 수집·이용 동의가 필요합니다." };
  }
  if (!isWaitDirection(input.direction)) {
    return { error: "방향(가는편/오는편)을 선택해주세요." };
  }
  const desired = validateDesiredDate(input.desiredDate);
  if (!desired.ok) return { error: desired.error };

  const validated = validatePassengers(input.passengers);
  if (!validated.ok) return { error: validated.error };
  const normalized = validated.normalized;

  const db = createAdminClient();

  // 대상 지구 실존 + 본인 지구 금지 (trip 신청의 "본인 지구 차량 불가"와 동일 취지).
  const { data: region } = await db
    .from("regions")
    .select("id")
    .eq("id", input.waitRegionId)
    .maybeSingle();
  const regionCheck = validateOperatorWaitRegion(region, session.regionId);
  if (!regionCheck.ok) return { error: regionCheck.error };

  // seat_request 생성 — trip_id=null이 "미배정 대기" 표식. wait_*는 배정 후에도 이력으로 보존.
  const { data: request, error: reqErr } = await db
    .from("seat_requests")
    .insert({
      trip_id: null,
      wait_region_id: input.waitRegionId,
      wait_direction: input.direction,
      wait_desired_date: desired.value,
      region_id: session.regionId,
      operator_id: session.operatorId,
      seat_count: normalized.length,
      status: "queued",
      consent_confirmed_at: new Date().toISOString(),
      consent_confirmed_by: session.operatorId,
    })
    .select("id")
    .single();

  if (reqErr || !request) return { error: "신청 저장 중 오류가 발생했습니다." };

  // 학생 명단 — 실패 시 신청 롤백 (createRequest와 동일).
  const { error: paxErr } = await db.from("request_passengers").insert(
    normalized.map((p) => ({
      request_id: request.id,
      name: p.name,
      phone: p.phone,
      school_or_role: p.school_or_role,
      note: p.note,
      priority: p.priority,
    })),
  );

  if (paxErr) {
    await db.from("seat_requests").delete().eq("id", request.id);
    return { error: "학생 명단 저장 중 오류가 발생했습니다." };
  }

  // 대상 지구 승인 간사 전원에게 "대기큐 신규 신청" 알림 — 베스트에포트.
  // trip이 없어 created_by가 없으므로 지구→간사 전원 해석은 호출자 책임(엔진은 id만 받음).
  try {
    const operatorIds = await approvedOperatorIdsForRegions(db, [input.waitRegionId]);
    await emit(
      NOTIFICATION_EVENTS.WAIT_REQUEST_NEW,
      { operatorIds },
      {
        requestId: request.id,
        waitRegionId: input.waitRegionId,
        seatCount: normalized.length,
      },
    );
  } catch {
    // 알림 발송 실패는 무시 (신청은 이미 저장됨)
  }

  revalidatePath("/status");
  redirect("/operator/requests");
}

// 신청 취소·수정 결과 — 클라이언트가 분기(성공 시 redirect, 실패 시 에러 표시).
type MutationResult = { ok: true } | { error: string };

// "이미 일부 학생이 매칭됨" 판단 기준 — 진행 중인 매칭 상태들(expired·cancelled 제외).
const ACTIVE_MATCH_STATUSES = ["awaiting_payment", "payment_reported", "paid"] as const;

/**
 * 신청 취소 (신청 간사) — 대기(queued) 중이고 진행 중 매칭이 없는 신청만.
 * 상태 가드 UPDATE로 원자적 처리(동시 매칭/중복 취소 방어). 공급 간사에 베스트에포트 알림.
 */
export async function cancelRequest(
  requestId: string,
  reason?: string,
): Promise<MutationResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  // 사유는 선택 — 있으면 trim + 500자 제한 (저장 컬럼 없음 → 알림 용도로만 사용).
  let trimmedReason: string | undefined;
  if (typeof reason === "string" && reason.trim().length > 0) {
    trimmedReason = reason.trim();
    if (trimmedReason.length > 500) {
      return { error: "취소 사유는 500자 이하로 입력해주세요." };
    }
  }

  const db = createAdminClient();

  const { data } = await db
    .from("seat_requests")
    .select(
      "id, region_id, status, trip_id, wait_region_id, trip:trips!trip_id(id, created_by)",
    )
    .eq("id", requestId)
    .maybeSingle();

  // trip_id null = 버스 미배정 대기 신청(대기큐) — trip embed도 null이 됨.
  const req = data as
    | { id: string; region_id: string; status: string; trip_id: string | null; wait_region_id: string | null; trip: { id: string; created_by: string | null } | { id: string; created_by: string | null }[] | null }
    | null;
  if (!req || req.region_id !== session.regionId) {
    return { error: "신청을 찾을 수 없습니다." };
  }
  if (req.status !== "queued") {
    return { error: "대기 중인 신청만 취소할 수 있습니다." };
  }

  // 진행 중 매칭이 하나라도 있으면 취소 불가 (공급 지구 협의 필요).
  const { data: activeMatches } = await db
    .from("matches")
    .select("id")
    .eq("request_id", requestId)
    .in("status", [...ACTIVE_MATCH_STATUSES])
    .limit(1);
  if (activeMatches && activeMatches.length > 0) {
    return {
      error:
        "이미 일부 학생이 매칭되어 취소할 수 없습니다. 공급 지구 간사와 협의가 필요합니다.",
    };
  }

  // 상태 가드 UPDATE — queued인 동안에만 cancelled로 전이(원자적).
  const { data: updated } = await db
    .from("seat_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!updated) {
    return { error: "이미 처리된 신청입니다." };
  }

  // 공급 지구 간사 알림 (베스트에포트 — 실패가 취소를 되돌리지 않음). reason은 페이로드 미포함(저장 컬럼 없음).
  const trip = Array.isArray(req.trip) ? (req.trip[0] ?? null) : req.trip;
  void trimmedReason; // 사유는 향후 알림 본문 확장 여지 — 현재 저장/전달 안 함.
  try {
    if (req.trip_id) {
      await emit(
        NOTIFICATION_EVENTS.REQUEST_CANCELLED,
        { supplyOperatorId: trip?.created_by ?? null },
        { requestId, tripId: req.trip_id },
      );
    } else if (req.wait_region_id) {
      // 대기 신청(trip 미배정) — created_by가 없으니 대상 지구 승인 간사 전원에게 같은 취지 알림.
      const operatorIds = await approvedOperatorIdsForRegions(db, [req.wait_region_id]);
      await emit(
        NOTIFICATION_EVENTS.WAIT_REQUEST_CANCELLED,
        { operatorIds },
        { requestId, waitRegionId: req.wait_region_id },
      );
    }
  } catch {
    // 알림 발송 실패는 무시 (취소는 이미 반영됨)
  }

  revalidatePath("/operator/requests");
  revalidatePath(`/operator/requests/${requestId}`);
  revalidatePath("/status");
  return { ok: true };
}

/**
 * 신청 수정 (신청 간사) — 대기(queued)·진행 중 매칭 없음일 때만 명단 전면 교체.
 * requested_at은 보존(큐 순번 유지 — cancel+재신청 대비 핵심 이점).
 * 새 학생(이름+전화 조합 신규) 추가 시에만 동의 필요.
 */
export async function updateRequest(
  requestId: string,
  passengers: PassengerInput[],
  consent: boolean,
): Promise<MutationResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  // 점검 모드·신청 마감 차단 (createRequest와 동일 가드).
  if (await isMaintenanceMode()) {
    return { error: "시스템 점검 중입니다. 잠시 후 다시 시도해주세요." };
  }
  if (await isPastRequestDeadline()) {
    return { error: "신청이 마감되었습니다. (마감일 이후에는 수정할 수 없습니다.)" };
  }

  const validated = validatePassengers(passengers);
  if (!validated.ok) return { error: validated.error };
  const normalized = validated.normalized;

  const db = createAdminClient();

  // 가드용 신청 + 기존 명단 로드.
  const { data } = await db
    .from("seat_requests")
    .select("id, region_id, status, request_passengers(name, phone)")
    .eq("id", requestId)
    .maybeSingle();

  const req = data as
    | { id: string; region_id: string; status: string; request_passengers: { name: string; phone: string }[] }
    | null;
  if (!req || req.region_id !== session.regionId) {
    return { error: "신청을 찾을 수 없습니다." };
  }
  if (req.status !== "queued") {
    return { error: "대기 중인 신청만 수정할 수 있습니다." };
  }

  // 진행 중 매칭이 있으면 수정 불가 (취소와 동일 가드).
  const { data: activeMatches } = await db
    .from("matches")
    .select("id")
    .eq("request_id", requestId)
    .in("status", [...ACTIVE_MATCH_STATUSES])
    .limit(1);
  if (activeMatches && activeMatches.length > 0) {
    return {
      error:
        "이미 일부 학생이 매칭되어 수정할 수 없습니다. 공급 지구 간사와 협의가 필요합니다.",
    };
  }

  // 새 학생 판단 — (이름+정규화 전화) 조합이 기존 명단에 없으면 신규. 순수 편집·삭제는 동의 불필요.
  const existingPairs = new Set(
    req.request_passengers.map((p) => `${p.name.trim()}|${cleanPhone(p.phone)}`),
  );
  const hasNewPassenger = normalized.some(
    (p) => !existingPairs.has(`${p.name}|${p.phone}`),
  );
  if (hasNewPassenger && consent !== true) {
    return {
      error: "새로 추가된 학생이 있어 개인정보 수집·이용 동의가 필요합니다.",
    };
  }

  // 동시 승인(approve_request_atomic) 레이스 차단 — 명단을 건드리기 전에 status='queued'를
  // 가드 UPDATE로 선점(claim)한다. 그 사이 매칭이 확정돼 status가 바뀌었으면 0행 → 삭제 없이 중단.
  // requested_at은 손대지 않음(큐 순번 보존). seat_count·동의는 이 선점 update에서 함께 갱신.
  const reqUpdate: { seat_count: number; consent_confirmed_at?: string; consent_confirmed_by?: string } = {
    seat_count: normalized.length,
  };
  if (hasNewPassenger) {
    reqUpdate.consent_confirmed_at = new Date().toISOString();
    reqUpdate.consent_confirmed_by = session.operatorId;
  }
  const { data: claimed } = await db
    .from("seat_requests")
    .update(reqUpdate)
    .eq("id", requestId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return {
      error: "수정하는 사이 매칭이 진행되어 수정할 수 없습니다. 새로고침 후 확인해주세요.",
    };
  }

  // 명단 전면 교체 — queued 선점 후 진행(이 명단을 참조하는 활성 매칭 없음).
  const { error: delErr } = await db
    .from("request_passengers")
    .delete()
    .eq("request_id", requestId);
  if (delErr) {
    return { error: "기존 명단 삭제 중 오류가 발생했습니다." };
  }

  const { error: insErr } = await db.from("request_passengers").insert(
    normalized.map((p) => ({
      request_id: requestId,
      name: p.name,
      phone: p.phone,
      school_or_role: p.school_or_role,
      note: p.note,
      priority: p.priority,
    })),
  );
  if (insErr) {
    return {
      error: "학생 명단 저장 중 오류가 발생했습니다. 다시 시도해주세요.",
    };
  }

  revalidatePath("/operator/requests");
  revalidatePath(`/operator/requests/${requestId}`);
  revalidatePath("/status");
  return { ok: true };
}
