"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

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

export async function createRequest(
  tripId: string,
  passengers: PassengerInput[],
  consent: boolean,
): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) {
    return { error: "소속 지구 정보가 없습니다. 관리자에게 문의해주세요." };
  }

  if (!consent) {
    return { error: "개인정보 수집·이용 동의가 필요합니다." };
  }

  if (!Array.isArray(passengers) || passengers.length === 0) {
    return { error: "학생을 1명 이상 입력해주세요." };
  }
  if (passengers.length > MAX_PASSENGERS) {
    return { error: `한 번에 최대 ${MAX_PASSENGERS}명까지 신청할 수 있습니다.` };
  }

  // 학생별 검증 + 정규화 (priority는 입력 순서대로 1..N 부여 — DB unique(request_id, priority) 충족)
  const normalized = passengers.map((p, i) => ({
    name: (p.name ?? "").trim(),
    phone: cleanPhone(p.phone ?? ""),
    school_or_role: (p.schoolOrRole ?? "").trim() || null,
    note: (p.note ?? "").trim() || null,
    priority: i + 1,
  }));

  for (const p of normalized) {
    if (p.name.length < 1 || p.name.length > 50) {
      return { error: "학생 이름을 1~50자로 입력해주세요." };
    }
    if (p.phone.length < 10 || p.phone.length > 11) {
      return { error: `전화번호를 올바르게 입력해주세요. (${p.name})` };
    }
    if (p.school_or_role && p.school_or_role.length > 100) {
      return { error: "학교/역할은 100자 이하로 입력해주세요." };
    }
    if (p.note && p.note.length > 200) {
      return { error: "메모는 200자 이하로 입력해주세요." };
    }
  }

  const db = createAdminClient();

  // 타지구 공개 trip만 신청 가능 — 본인 지구 trip엔 신청 불가, draft/closed 불가
  const { data: trip } = await db
    .from("trips")
    .select("id, status, operator_region_id")
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

  redirect("/operator/requests");
}
