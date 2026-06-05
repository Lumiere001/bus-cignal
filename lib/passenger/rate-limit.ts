import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 학생 본인확인(예약번호+이름+전화끝4) 무차별 대입 방어.
 * 예약번호별로 실패 누적 → 임계 초과 시 잠금. 성공/만료 시 리셋.
 * (링크 유출 시 이름+전화끝4 추측을 늦추는 게 목적. CCC 내부 도구라 코드 단위로 충분.)
 */
const MAX_ATTEMPTS = 7;
const LOCK_MS = 30 * 60 * 1000; // 30분

/** 현재 잠금 상태인지. */
export async function isVerifyLocked(code: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("reservation_verify_attempts")
    .select("locked_until")
    .eq("code", code)
    .maybeSingle();
  if (!data?.locked_until) return false;
  return new Date(data.locked_until).getTime() > Date.now();
}

/** 실패 1회 기록. 임계 초과 시 잠금. 잠금 만료 후 첫 실패는 카운터 리셋부터. */
export async function recordVerifyFailure(code: string): Promise<void> {
  const db = createAdminClient();
  const { data } = await db
    .from("reservation_verify_attempts")
    .select("attempts, locked_until")
    .eq("code", code)
    .maybeSingle();

  const expired =
    !!data?.locked_until &&
    new Date(data.locked_until).getTime() <= Date.now();
  const attempts = (expired ? 0 : (data?.attempts ?? 0)) + 1;
  const lockedUntil =
    attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCK_MS).toISOString()
      : null;

  await db.from("reservation_verify_attempts").upsert({
    code,
    attempts,
    locked_until: lockedUntil,
    updated_at: new Date().toISOString(),
  });
}

/** 성공 시 시도 기록 제거. */
export async function clearVerifyAttempts(code: string): Promise<void> {
  const db = createAdminClient();
  await db.from("reservation_verify_attempts").delete().eq("code", code);
}
