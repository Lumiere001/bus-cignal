import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 현재 간사의 지구명 — 화면 제목/배너에 "○○ 운영 현황"·"○○ 지구 공급 차량"처럼 표기용.
 * regionId 미배정(null)·미존재 시 "내 지구" 폴백. (간사 화면 전반 공용)
 */
export async function getOperatorRegionName(regionId: string | null): Promise<string> {
  if (!regionId) return "내 지구";
  const db = createAdminClient();
  const { data } = await db.from("regions").select("name").eq("id", regionId).maybeSingle();
  return data?.name ?? "내 지구";
}
