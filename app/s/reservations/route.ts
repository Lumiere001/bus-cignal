import { NextResponse, type NextRequest } from "next/server";
import { getStudentSession } from "@/lib/auth/student";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PASSENGER_COOKIE,
  PASSENGER_SESSION_DAYS,
  signPassengerToken,
} from "@/lib/auth/passenger-session";
import { normalizePhone, phoneCandidates } from "@/lib/passenger/operator-booked";

export const dynamic = "force-dynamic";

/**
 * 학생 "예약 확인" — 본인의 확정(paid) 예약 신원(match_passengers)으로 passenger 세션을
 * 발급하고 기존 `/me` 화면으로 보낸다. (/me·지도·예약취소 코드는 그대로 재사용 → 회귀 0)
 *
 * 신원 매핑 두 갈래:
 *  1) students → 본인 seat_requests → paid matches → match_passengers (직접 신청분)
 *  2) students.phone과 같은 전화의 match_passengers (간사가 대신 잡아준 예약 — student_id 없음)
 * 둘 다 본인 신원(전화)에서만 출발하므로 남의 예약으로 넘어갈 수 없다. 없으면 허브로 안내.
 */
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;

  const session = await getStudentSession();
  if (!session) return NextResponse.redirect(new URL("/s/login", base));

  const db = createAdminClient();

  // 1. 본인 신청들
  const { data: reqs } = await db
    .from("seat_requests")
    .select("id")
    .eq("student_id", session.studentId);
  const reqIds = (reqs ?? []).map((r) => r.id);

  // 2. 그 신청의 paid 매칭 → 3. 검증 레코드(match_passengers) id
  let passengerId: string | null = null;
  if (reqIds.length) {
    const { data: paid } = await db
      .from("matches")
      .select("id")
      .in("request_id", reqIds)
      .eq("status", "paid");
    const matchIds = (paid ?? []).map((m) => m.id);
    if (matchIds.length) {
      const { data: mp } = await db
        .from("match_passengers")
        .select("id")
        .in("match_id", matchIds)
        .limit(1);
      passengerId = mp?.[0]?.id ?? null;
    }
  }

  // 2-b. 간사가 대신 잡아준 예약 — 본인 신청(student_id) 없이도 같은 전화의 확정 예약을 연결.
  //      match_passengers는 입금 확인(paid) 시 생성되므로, 전화로 찾으면 곧 확정 예약이다.
  if (!passengerId) {
    const { data: student } = await db
      .from("students")
      .select("phone")
      .eq("id", session.studentId)
      .maybeSingle();
    const digits = normalizePhone(student?.phone);
    if (digits.length >= 10) {
      const { data: mp } = await db
        .from("match_passengers")
        .select("id")
        .in("phone", phoneCandidates(digits))
        .limit(1);
      passengerId = mp?.[0]?.id ?? null;
    }
  }

  // 확정 예약이 아직 없으면 허브로 되돌려 안내 (passenger 세션 미발급).
  if (!passengerId) {
    return NextResponse.redirect(new URL("/s?reservations=empty", base));
  }

  // 본인 확정 예약 신원으로 passenger 세션 발급 → /me (getMatchesForPassenger가 이름+전화로 전체 조회)
  const token = await signPassengerToken({ passengerId });
  const res = NextResponse.redirect(new URL("/me", base));
  res.cookies.set(PASSENGER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PASSENGER_SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
