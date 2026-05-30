"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPERATOR_COOKIE, signOperatorToken } from "./operator-session";
import { MASTER_COOKIE, signMasterToken } from "./master-session";

// ⚠️ 개발 전용 진입점. 프로덕션에서는 비활성 (CCC 로그인 연동 전 seed 테스트용).
function assertDevLoginEnabled() {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEV_LOGIN === "true";
  if (!enabled) throw new Error("dev login is disabled in production");
}

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** seed된 승인 간사로 세션 발급 (dev 전용) → /operator. */
export async function devLoginAsOperator(operatorId: string) {
  assertDevLoginEnabled();
  const db = createAdminClient();
  const { data: op } = await db
    .from("operators")
    .select("id, ccc_id, region_id, approval_status")
    .eq("id", operatorId)
    .maybeSingle();
  if (!op || op.approval_status !== "approved") {
    throw new Error("승인된 간사를 찾을 수 없습니다 (seed:dev 먼저 실행)");
  }
  const token = await signOperatorToken({
    operatorId: op.id,
    cccId: op.ccc_id ?? "",
    regionId: op.region_id,
  });
  const c = await cookies();
  c.set(OPERATOR_COOKIE, token, { ...baseCookie, maxAge: 12 * 60 * 60 });
  redirect("/operator");
}

/** 마스터 세션 발급 (dev 전용) → /admin. */
export async function devLoginAsMaster() {
  assertDevLoginEnabled();
  const token = await signMasterToken();
  const c = await cookies();
  c.set(MASTER_COOKIE, token, { ...baseCookie, maxAge: 24 * 60 * 60 });
  redirect("/admin");
}
