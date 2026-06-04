"use server";

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

type ActionResult = { error: string } | { ok: true };

function firstOf<T>(rel: T | T[] | null | undefined): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
}

/**
 * 송금 완료 보고 (신청 간사 — SPEC §S4 step2): awaiting_payment → payment_reported.
 * 본인 지구가 신청한 매칭만. 상태 가드 UPDATE로 원자적.
 */
export async function reportPayment(matchId: string): Promise<ActionResult> {
  const session = await requireOperator();
  if (!session.regionId) return { error: "소속 지구 정보가 없습니다." };

  const db = createAdminClient();

  // 본인 지구가 신청 주체인 매칭인지 확인
  const { data: match } = await db
    .from("matches")
    .select(
      "id, status, request:seat_requests!request_id(region_id), trip:trips!trip_id(created_by)",
    )
    .eq("id", matchId)
    .single();

  if (!match) return { error: "매칭을 찾을 수 없습니다." };
  if (firstOf(match.request)?.region_id !== session.regionId) {
    return { error: "권한이 없습니다." };
  }

  const { data, error } = await db
    .from("matches")
    .update({
      status: "payment_reported",
      payment_reported_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("status", "awaiting_payment")
    .select("id")
    .maybeSingle();
  if (error) return { error: "송금 완료 보고 중 오류가 발생했습니다." };
  if (!data) return { error: "이미 처리된 매칭입니다." };

  // 알림: 송금 완료 보고 → 공급 지구 간사 (SPEC §S8). 실패해도 본 처리엔 영향 없음.
  try {
    await emit(
      "payment_reported",
      { supplyOperatorId: firstOf(match.trip)?.created_by ?? null },
      { matchId },
    );
  } catch {
    /* 알림 실패 무시 */
  }

  revalidatePath("/operator/matches");
  return { ok: true };
}
