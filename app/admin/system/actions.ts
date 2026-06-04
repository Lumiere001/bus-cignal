"use server";

import { revalidatePath } from "next/cache";
import { verifyMasterSession } from "@/lib/auth/master";
import { createAdminClient } from "@/lib/supabase/admin";
import { ANONYMIZE_KEY, MAINTENANCE_KEY, REQUEST_DEADLINE_KEY } from "./keys";

// 마스터 전용 시스템 설정(SPEC §2.1·§4.4) — 점검 모드·신청 마감일·익명화 예정일.
// system_config(key/value) upsert. middleware가 /admin/* 보호하지만 서버액션은
// 직접 호출 가능하므로 매 호출 마스터 세션 재검증(다층 방어).

async function assertMaster() {
  if (!(await verifyMasterSession())) throw new Error("권한 없음 — 마스터 세션 필요");
}

async function setConfig(key: string, value: string) {
  const db = createAdminClient();
  const { error } = await db.from("system_config").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: "master",
  });
  if (error) throw error;
}

async function clearConfig(key: string) {
  const db = createAdminClient();
  const { error } = await db.from("system_config").delete().eq("key", key);
  if (error) throw error;
}

/** YYYY-MM-DD → KST 경계 ISO. 잘못된 형식이면 throw. */
function toKstIso(date: string, endOfDay: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("날짜 형식 오류 (YYYY-MM-DD)");
  const time = endOfDay ? "23:59:59" : "00:00:00";
  const iso = new Date(`${date}T${time}+09:00`);
  if (Number.isNaN(iso.getTime())) throw new Error("유효하지 않은 날짜");
  return iso.toISOString();
}

/** 점검 모드 on/off (현재 상태를 반대로 토글). */
export async function toggleMaintenance(turnOn: boolean) {
  await assertMaster();
  await setConfig(MAINTENANCE_KEY, turnOn ? "on" : "off");
  revalidatePath("/admin/system");
}

/** 신청 마감일 설정 — 그날 끝(23:59 KST)까지 신청 허용. */
export async function setRequestDeadline(formData: FormData) {
  await assertMaster();
  const date = String(formData.get("date") ?? "").trim();
  if (!date) {
    await clearConfig(REQUEST_DEADLINE_KEY);
  } else {
    await setConfig(REQUEST_DEADLINE_KEY, toKstIso(date, true));
  }
  revalidatePath("/admin/system");
}

/** 데이터 익명화 예정일 — cron(anonymize)·대시보드 D-day가 읽는 값(00:00 KST). */
export async function setAnonymizeAfter(formData: FormData) {
  await assertMaster();
  const date = String(formData.get("date") ?? "").trim();
  if (!date) {
    await clearConfig(ANONYMIZE_KEY);
  } else {
    await setConfig(ANONYMIZE_KEY, toKstIso(date, false));
  }
  revalidatePath("/admin/system");
  revalidatePath("/admin");
}
