import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { branchCode, type HandoffPayload } from "./handoff";

/**
 * CCC 학생 핸드오프 payload → student 프로비저닝.
 *  - target_role=student로 CCC가 1차 거르지만, is_staff=true면 방어적 거부(간사 로그인으로 안내).
 *  - branch_no → regions.code(출신 지구) 매핑. 미등록 지구면 region_id=null로 로그인은 허용
 *    (신청 단계에서 지구 필요 — 향후 처리). ccc_id로 upsert(재로그인 시 최신화).
 */

export type StudentProvisionResult =
  | { ok: true; studentId: string; regionId: string | null; cccId: string }
  | { ok: false; error: "is_staff" | "db_error" };

export async function provisionStudentFromCcc(
  subjectId: string,
  payload: HandoffPayload,
): Promise<StudentProvisionResult> {
  if (payload.is_staff === true) return { ok: false, error: "is_staff" };

  const db = createAdminClient();

  // 출신 지구 매핑(있으면). 미등록이어도 로그인 자체는 막지 않는다.
  let regionId: string | null = null;
  const code = branchCode(payload);
  if (code) {
    const { data: region } = await db
      .from("regions")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    regionId = region?.id ?? null;
  }

  const now = new Date().toISOString();
  const name = payload.name ?? null;
  const phone = payload.phone ?? null;
  const campus = payload.univ_name ?? null;

  // ccc_id로 기존 학생 조회 → 갱신, 없으면 생성.
  const { data: existing } = await db
    .from("students")
    .select("id")
    .eq("ccc_id", subjectId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("students")
      .update({ name, phone, region_id: regionId, campus, last_login_at: now })
      .eq("id", existing.id);
    if (error) return { ok: false, error: "db_error" };
    return { ok: true, studentId: existing.id, regionId, cccId: subjectId };
  }

  const { data: inserted, error } = await db
    .from("students")
    .insert({
      ccc_id: subjectId,
      name,
      phone,
      region_id: regionId,
      campus,
      last_login_at: now,
    })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: "db_error" };
  return { ok: true, studentId: inserted.id, regionId, cccId: subjectId };
}
