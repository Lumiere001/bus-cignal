import { createAdminClient } from "@/lib/supabase/admin";

// system_config(key/value) 읽기 헬퍼 + 키 상수(단일 출처).
// 쓰기는 마스터 전용(app/admin/system/actions.ts). 읽기는 운영 전반에서 차단 적용에 사용.

export const MAINTENANCE_KEY = "maintenance_mode";
export const REQUEST_DEADLINE_KEY = "request_deadline";
export const ANONYMIZE_KEY = "anonymize_after";

async function getConfig(key: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("system_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

/** 점검 모드 on 여부. */
export async function isMaintenanceMode(): Promise<boolean> {
  return (await getConfig(MAINTENANCE_KEY)) === "on";
}

/** 신청 마감 시각 ISO(KST 그날 끝). 미설정이면 null. */
export async function getRequestDeadline(): Promise<string | null> {
  return await getConfig(REQUEST_DEADLINE_KEY);
}

/** 현재 시각이 신청 마감을 지났는가. 마감일 미설정이면 항상 false(마감 없음). */
export async function isPastRequestDeadline(): Promise<boolean> {
  const deadline = await getRequestDeadline();
  if (!deadline) return false;
  return Date.now() > new Date(deadline).getTime();
}
