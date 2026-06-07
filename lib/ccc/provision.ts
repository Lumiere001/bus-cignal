import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { branchCode, isEligibleStaff, type HandoffPayload } from "./handoff";

/**
 * CCC 핸드오프 payload → operator 프로비저닝. (사용자 정책 2026-06-08: CCC 간사면 자동 승인)
 *
 *  - is_staff=true 만 통과(target_role=staff로 CCC가 1차 거름, 여기서 방어적 재확인).
 *  - branch_no → regions.code(4자리 CCC 지구번호) 직접 매핑.
 *  - ccc_id(subject_id)로 식별. 신규=자동 approved, 기존=정보 갱신 + approved 유지.
 *  - **revoked 간사는 재승인하지 않는다**(마스터가 막은 사람을 로그인으로 되살리지 않음).
 */

export type ProvisionResult =
  | { ok: true; operatorId: string; regionId: string; cccId: string }
  | { ok: false; error: "not_staff" | "region_unmapped" | "revoked" | "db_error" };

export async function provisionOperatorFromCcc(
  subjectId: string,
  payload: HandoffPayload,
): Promise<ProvisionResult> {
  if (!isEligibleStaff(payload)) return { ok: false, error: "not_staff" };

  const code = branchCode(payload);
  if (!code) return { ok: false, error: "region_unmapped" };

  const db = createAdminClient();

  // 지구(branch_no) → region. 시드 안 된 지구면 운영자에게 추가 요청 필요.
  const { data: region } = await db
    .from("regions")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!region) return { ok: false, error: "region_unmapped" };

  const now = new Date().toISOString();
  const name = payload.name ?? null;
  const phone = payload.phone ?? null;

  // ccc_id로 기존 간사 조회 — revoke 상태면 로그인 차단(자동 재승인 금지).
  const { data: existing } = await db
    .from("operators")
    .select("id, approval_status")
    .eq("ccc_id", subjectId)
    .maybeSingle();

  if (existing) {
    if (existing.approval_status === "revoked") {
      return { ok: false, error: "revoked" };
    }
    const { error } = await db
      .from("operators")
      .update({
        name,
        phone,
        region_id: region.id,
        ccc_role: "staff",
        approval_status: "approved",
        approved_at: now,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: "db_error" };
    return { ok: true, operatorId: existing.id, regionId: region.id, cccId: subjectId };
  }

  // 신규 — CCC 간사 자동 승인.
  const { data: inserted, error } = await db
    .from("operators")
    .insert({
      ccc_id: subjectId,
      name,
      phone,
      region_id: region.id,
      ccc_role: "staff",
      role: "operator",
      approval_status: "approved",
      approved_at: now,
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: "db_error" };
  return { ok: true, operatorId: inserted.id, regionId: region.id, cccId: subjectId };
}
