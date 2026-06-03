import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PassengerClaims } from "@/lib/auth/passenger-session";

/**
 * 예약번호 + 이름 + 전화 끝 4자리로 학생 신원 확인.
 * 성공 시 access_token_hash를 갱신하고 PassengerClaims 반환.
 * 개인정보(이름·전화)는 로그·에러 메시지에 포함하지 않음.
 */
export async function verifyReservationEntry(
  code: string,
  name: string,
  phoneLast4: string,
): Promise<PassengerClaims | null> {
  const db = createAdminClient();

  // 예약번호로 match 조회
  const { data: match } = await db
    .from("matches")
    .select("id")
    .eq("reservation_code", code)
    .maybeSingle();

  if (!match) return null;

  // match_passengers 조회
  const { data: mp } = await db
    .from("match_passengers")
    .select("id, name, phone")
    .eq("match_id", match.id)
    .maybeSingle();

  if (!mp) return null;

  // 이름 + 전화 끝 4자리 검증
  const nameOk = mp.name === name;
  const phoneDigits = mp.phone.replace(/\D/g, "");
  const phoneOk = phoneDigits.endsWith(phoneLast4);

  if (!nameOk || !phoneOk) return null;

  // access_token_hash 갱신 (검증 흐름 — 세션 발급 기록 + last_seen 갱신)
  const rawToken = crypto.randomUUID();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { error: updateError } = await db
    .from("match_passengers")
    .update({
      access_token_hash: hash,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", mp.id);

  // hash 저장 실패 시 세션 발급 차단 (fail-closed)
  if (updateError) return null;

  return { matchPassengerId: mp.id, sessionToken: rawToken };
}
