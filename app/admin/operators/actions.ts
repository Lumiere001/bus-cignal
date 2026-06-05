"use server";

import { revalidatePath } from "next/cache";
import { verifyMasterSession } from "@/lib/auth/master";
import { generateLoginToken } from "@/lib/auth/operator-magic";
import { emit } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// 마스터 전용 간사 권한 관리 — 승인 / 거절 / 비활성화.
// ⚠️ middleware가 /admin/*를 보호하지만, 서버 액션은 직접 호출될 수 있으므로
//    각 액션에서 마스터 세션을 다시 검증한다(다층 방어).

async function assertMaster() {
  if (!(await verifyMasterSession())) {
    throw new Error("권한 없음 — 마스터 세션 필요");
  }
}

/** 가입 승인 — pending → approved. 신청 지구를 소속 지구로 확정. */
export async function approveOperator(operatorId: string) {
  await assertMaster();
  const db = createAdminClient();

  const { data: op } = await db
    .from("operators")
    .select("id, requested_region_id, region_id, approval_status")
    .eq("id", operatorId)
    .maybeSingle();
  if (!op) throw new Error("간사를 찾을 수 없음");
  if (op.approval_status !== "pending") throw new Error("이미 처리된 가입 신청");

  const regionId = op.requested_region_id ?? op.region_id;
  if (!regionId) throw new Error("배정할 지구 없음 — 신청 지구 미지정");

  // 동시 이중 처리 방지: approval_status='pending' 가드를 UPDATE에 포함.
  const { data, error } = await db
    .from("operators")
    .update({
      approval_status: "approved",
      region_id: regionId,
      approved_at: new Date().toISOString(),
      // 매직링크 입장 토큰 발급(임시 로그인). 마스터가 /admin/operators에서 링크 전달.
      login_token: generateLoginToken(),
    })
    .eq("id", operatorId)
    .eq("approval_status", "pending")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("이미 처리됨");

  revalidatePath("/admin/operators/pending");
  revalidatePath("/admin/operators");
}

/** 가입 거절 — pending → rejected. */
export async function rejectOperator(operatorId: string) {
  await assertMaster();
  const db = createAdminClient();

  const { data, error } = await db
    .from("operators")
    .update({ approval_status: "rejected" })
    .eq("id", operatorId)
    .eq("approval_status", "pending")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("이미 처리됨");

  revalidatePath("/admin/operators/pending");
}

/** 권한 비활성화 — approved → revoked + 본인·동지구 간사 알림(SPEC §5.10). */
export async function revokeOperator(operatorId: string, reason: string) {
  await assertMaster();
  const trimmed = reason.trim();
  if (trimmed.length < 5) throw new Error("해제 사유 5자 이상 입력");

  const db = createAdminClient();

  const { data: op } = await db
    .from("operators")
    .select("id, region_id, approval_status")
    .eq("id", operatorId)
    .maybeSingle();
  if (!op) throw new Error("간사를 찾을 수 없음");
  if (op.approval_status !== "approved") throw new Error("활성 간사만 비활성화 가능");

  const { data, error } = await db
    .from("operators")
    .update({
      approval_status: "revoked",
      revoked_at: new Date().toISOString(),
      revoke_reason: trimmed,
      // 매직링크 무효화 — 해제된 간사의 입장 링크는 즉시 차단.
      login_token: null,
    })
    .eq("id", operatorId)
    .eq("approval_status", "approved")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("이미 처리됨");

  // 알림: 본인 + 같은 지구의 다른 활성 간사 (인수인계 확인).
  const recipients = new Set<string>([operatorId]);
  if (op.region_id) {
    const { data: peers } = await db
      .from("operators")
      .select("id")
      .eq("region_id", op.region_id)
      .eq("approval_status", "approved")
      .neq("id", operatorId);
    for (const p of peers ?? []) recipients.add(p.id);
  }
  // best-effort — 알림 실패가 권한 해제를 막지 않도록 격리.
  try {
    await emit("operator_revoked", { operatorIds: [...recipients] }, { operatorId });
  } catch {
    // 인앱 row 기록 실패는 무해(핵심 흐름=권한 해제는 이미 커밋됨).
  }

  revalidatePath("/admin/operators");
}

/**
 * 간사 직접 추가 (CCC 본구현 전 임시 온보딩) — 마스터가 이름·지구로 생성.
 * 즉시 approved + 매직링크 토큰 발급 → 마스터가 링크를 카톡으로 전달.
 * (CCC 연동 시 self-signup→승인 흐름으로 전환, 이 경로는 보조 수단으로 유지/제거.)
 */
export async function createOperator(formData: FormData) {
  await assertMaster();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const regionId = String(formData.get("regionId") ?? "").trim();
  if (!name) throw new Error("이름을 입력하세요");
  if (!regionId) throw new Error("지구를 선택하세요");

  const db = createAdminClient();
  const { error } = await db.from("operators").insert({
    name,
    phone: phone || null,
    region_id: regionId,
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    login_token: generateLoginToken(),
  });
  if (error) throw error;

  revalidatePath("/admin/operators");
}

/**
 * 간사 입장 링크(매직링크) 재발급 — 기존 토큰 폐기·새 토큰 발급.
 * 링크 누출·분실 대비. 활성(approved) 간사만 대상.
 */
export async function regenerateLoginToken(operatorId: string) {
  await assertMaster();
  const db = createAdminClient();

  const { data, error } = await db
    .from("operators")
    .update({ login_token: generateLoginToken() })
    .eq("id", operatorId)
    .eq("approval_status", "approved")
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("활성 간사만 입장 링크를 발급할 수 있음");

  revalidatePath("/admin/operators");
}
