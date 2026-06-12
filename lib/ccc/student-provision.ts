import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { branchCode, type HandoffPayload } from "./handoff";
import { nonEmpty, pickEarliest } from "./identity";

/**
 * CCC 핸드오프 payload → student 프로비저닝.
 *  - **간사(is_staff=true)도 학생으로 프로비저닝**한다(차단 X). 간사가 학생 로그인으로 들어와
 *    학생 화면을 보거나 본인이 직접 버스를 신청할 수 있게. (간사 신원/operators row는 그대로
 *    유지 — students는 같은 ccc_id로 별도 신원, 학생 흐름 전용.)
 *  - branch_no → regions.code(출신 지구) 매핑. 미등록 지구면 region_id=null로 로그인은 허용
 *    (신청 단계에서 지구 필요). ccc_id로 upsert(재로그인 시 최신화).
 *  - **자기치유(self-heal)**: subject_id가 세션마다 달라지는 사례(prod 확인) 대응 —
 *    ccc_id 미스 시 phone+name(둘 다 non-empty일 때만)으로 기존 신원을 찾아 ccc_id를
 *    새 값으로 교체·재사용. 새 행이 생기면 이전 신청(seat_requests.student_id)이
 *    본인 화면에서 사라지기 때문. (학생은 staff_no 없음.)
 */

export type StudentProvisionResult =
  | { ok: true; studentId: string; regionId: string | null; cccId: string }
  | { ok: false; error: "db_error" };

export async function provisionStudentFromCcc(
  subjectId: string,
  payload: HandoffPayload,
): Promise<StudentProvisionResult> {
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

  // ── 자기치유: ccc_id 미스 — subject_id가 바뀌었을 수 있으니 phone+name으로
  //   기존 신원 탐색(둘 다 non-empty일 때만). 후보 여럿이면 created_at 최초 행 채택.
  const healPhone = nonEmpty(phone);
  const healName = nonEmpty(name);
  if (healPhone && healName) {
    const { data: byPhoneName } = await db
      .from("students")
      .select("id, created_at")
      .eq("phone", healPhone)
      .eq("name", healName);
    const adopted = pickEarliest(byPhoneName);
    if (adopted) {
      // 기존 신원 재사용 — ccc_id를 새 subjectId로 교체(새 값은 미사용이라 unique 충돌 없음).
      const { error } = await db
        .from("students")
        .update({
          ccc_id: subjectId,
          name,
          phone,
          region_id: regionId,
          campus,
          last_login_at: now,
        })
        .eq("id", adopted.id);
      if (error) return { ok: false, error: "db_error" };
      return { ok: true, studentId: adopted.id, regionId, cccId: subjectId };
    }
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
