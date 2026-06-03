import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PassengerClaims } from "@/lib/auth/passenger-session";

/**
 * 예약번호 + 이름 + 전화 끝 4자리로 학생 신원 확인.
 * 성공 시 PassengerClaims 반환.
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

  return { passengerId: mp.id };
}
