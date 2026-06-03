"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReservationEntrySchema } from "@/lib/validators/passenger";
import { verifyReservationEntry } from "@/lib/passenger/verify";
import {
  signPassengerToken,
  PASSENGER_COOKIE,
  PASSENGER_SESSION_DAYS,
} from "@/lib/auth/passenger-session";

const SESSION_MAX_AGE = PASSENGER_SESSION_DAYS * 24 * 60 * 60;

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

  const claims = await verifyReservationEntry(
    code,
    parsed.data.name,
    parsed.data.phoneLast4,
  );

  if (!claims) {
    redirect(`/r/${encodeURIComponent(code)}?error=notfound`);
  }

  const token = await signPassengerToken(claims);
  const c = await cookies();
  c.set(PASSENGER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/me");
}
