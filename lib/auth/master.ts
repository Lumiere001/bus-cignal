import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { MASTER_COOKIE, signMasterToken, verifyMasterToken } from "./master-session";

// SPEC §2.1·§8: 5회 실패 1h 잠금, 세션 24h
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 60 * 1000;
const SESSION_SEC = 24 * 60 * 60;

async function getConfig(key: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("system_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

async function setConfig(key: string, value: string) {
  const db = createAdminClient();
  await db.from("system_config").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: "master-auth",
  });
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "locked"; until: number }
  | { ok: false; reason: "invalid"; remaining: number };

/** 마스터 비번 시도 — 성공 시 세션 쿠키 발급, 실패 시 카운트·잠금. */
export async function attemptMasterLogin(password: string): Promise<LoginResult> {
  const lockUntil = Number((await getConfig("master_lock_until")) ?? "0");
  if (lockUntil > Date.now()) {
    return { ok: false, reason: "locked", until: lockUntil };
  }

  // 잠금 만료 후 첫 진입: 시도 카운터·잠금을 리셋해 새 윈도우 시작.
  // (없으면 attempts=5가 잔존 → 만료 후 1회만 틀려도 즉시 재잠금 = 자기-DoS)
  if (lockUntil > 0) {
    await setConfig("master_login_attempts", "0");
    await setConfig("master_lock_until", "0");
  }

  const hash = process.env.MASTER_PASSWORD_HASH!;
  const ok = await bcrypt.compare(password, hash);

  if (ok) {
    await setConfig("master_login_attempts", "0");
    const token = await signMasterToken();
    const c = await cookies();
    c.set(MASTER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_SEC,
      path: "/",
    });
    return { ok: true };
  }

  const attempts = Number((await getConfig("master_login_attempts")) ?? "0") + 1;
  await setConfig("master_login_attempts", String(attempts));
  if (attempts >= MAX_ATTEMPTS) {
    const until = Date.now() + LOCK_MS;
    await setConfig("master_lock_until", String(until));
    return { ok: false, reason: "locked", until };
  }
  return { ok: false, reason: "invalid", remaining: MAX_ATTEMPTS - attempts };
}

/** 서버 컴포넌트·액션에서 마스터 세션 확인. */
export async function verifyMasterSession(): Promise<boolean> {
  const c = await cookies();
  return verifyMasterToken(c.get(MASTER_COOKIE)?.value);
}

/** 로그아웃. */
export async function clearMasterSession() {
  const c = await cookies();
  c.delete(MASTER_COOKIE);
}
