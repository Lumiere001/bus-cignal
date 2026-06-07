"use server";

import { redirect } from "next/navigation";
import {
  RESERVATION_PREFIX,
  isValidReservationCode,
} from "@/lib/reservation/code";

/**
 * 예약번호 입력 → 본인확인 페이지(/r/<code>)로 이동.
 *   - 대소문자·공백 정규화. 하이픈 없이 4글자만 넣으면 `BUS-` 자동 보정.
 *   - 형식이 틀리면 ?error=invalid 로 되돌린다(존재 여부는 /r/<code>에서 본인확인으로 판별).
 */
export async function lookupReservation(formData: FormData): Promise<void> {
  const raw = String(formData.get("code") ?? "");
  let code = raw.trim().toUpperCase().replace(/\s+/g, "");

  // "AB2C" 처럼 접두어 없이 4글자만 입력한 경우 BUS- 보정.
  if (!code.includes("-") && code.length === 4) {
    code = RESERVATION_PREFIX + code;
  }

  if (!isValidReservationCode(code)) {
    redirect("/r?error=invalid");
  }

  redirect(`/r/${encodeURIComponent(code)}`);
}
