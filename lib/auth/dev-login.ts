"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OPERATOR_COOKIE,
  OPERATOR_SESSION_DAYS,
  signOperatorToken,
} from "./operator-session";
import { MASTER_COOKIE, signMasterToken } from "./master-session";
import {
  STUDENT_COOKIE,
  STUDENT_SESSION_DAYS,
  signStudentToken,
} from "./student-session";
import { devLoginEnabled } from "./dev-login-guard";

// ⚠️ 개발 전용 진입점. Vercel production에선 항상 비활성(백도어 방지) — dev-login-guard.
function assertDevLoginEnabled() {
  if (!devLoginEnabled()) throw new Error("dev login is disabled in production");
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
  c.set(OPERATOR_COOKIE, token, {
    ...baseCookie,
    maxAge: OPERATOR_SESSION_DAYS * 24 * 60 * 60,
  });
  redirect("/operator");
}

/** seed된 CCC 학생으로 세션 발급 (dev 전용) → /s. 학생 직접신청 흐름 테스트용. */
export async function devLoginAsStudent(studentId: string) {
  assertDevLoginEnabled();
  const db = createAdminClient();
  const { data: st } = await db
    .from("students")
    .select("id, ccc_id, region_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!st) {
    throw new Error("학생을 찾을 수 없습니다 (seed:dev 먼저 실행)");
  }
  const token = await signStudentToken({
    studentId: st.id,
    cccId: st.ccc_id,
    regionId: st.region_id,
  });
  const c = await cookies();
  c.set(STUDENT_COOKIE, token, {
    ...baseCookie,
    maxAge: STUDENT_SESSION_DAYS * 24 * 60 * 60,
  });
  redirect("/s");
}

/** 마스터 세션 발급 (dev 전용) → /admin. */
export async function devLoginAsMaster() {
  assertDevLoginEnabled();
  const token = await signMasterToken();
  const c = await cookies();
  c.set(MASTER_COOKIE, token, { ...baseCookie, maxAge: 24 * 60 * 60 });
  redirect("/admin");
}
