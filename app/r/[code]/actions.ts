"use server";

import { redirect } from "next/navigation";
import { ReservationEntrySchema } from "@/lib/validators/passenger";
import { verifyReservationEntry } from "@/lib/passenger/verify";
import {
  isVerifyLocked,
  recordVerifyFailure,
  clearVerifyAttempts,
} from "@/lib/passenger/rate-limit";
import { issuePassengerSession } from "@/lib/auth/passenger";

// 예약번호 형식: 대문자 영숫자 1~10자 + 하이픈 + 대문자 영숫자 1~10자 (예: BUS-7K9M)
const CODE_PATTERN = /^[A-Z0-9]{1,10}-[A-Z0-9]{1,10}$/;

/** 예약번호 진입 폼 제출 처리. 검증 성공 시 /me로 이동. */
export async function verifyEntry(code: string, formData: FormData): Promise<void> {
  // 예약번호 형식 검증 (임의 문자열 DB 조회 방지)
  if (!CODE_PATTERN.test(code)) {
    redirect(`/r/${encodeURIComponent(code)}?error=invalid`);
  }

  const raw = {
    name: formData.get("name"),
    phoneLast4: formData.get("phoneLast4"),
  };

  const parsed = ReservationEntrySchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/r/${encodeURIComponent(code)}?error=invalid`);
  }

  // 무차별 대입 방어 — 잠금 중이면 검증 자체를 막음
  if (await isVerifyLocked(code)) {
    redirect(`/r/${encodeURIComponent(code)}?error=locked`);
  }

  const claims = await verifyReservationEntry(
    code,
    parsed.data.name,
    parsed.data.phoneLast4,
  );

  if (!claims) {
    await recordVerifyFailure(code); // 실패 누적 → 임계 초과 시 잠금
    redirect(`/r/${encodeURIComponent(code)}?error=notfound`);
  }

  await clearVerifyAttempts(code); // 성공 → 시도 기록 제거
  await issuePassengerSession(claims.passengerId);

  redirect("/me");
}
