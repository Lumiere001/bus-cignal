import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/notifications";
import { one } from "@/lib/supabase/relation";

export const dynamic = "force-dynamic";

// 출발 리마인더 — 외부 스케줄러(GitHub Actions)가 호출. SPEC §8(depart_d1).
// "출발 전에만": 출발이 now < t <= now+24h 인 paid 매칭에 1회 알림(양쪽 간사 + 학생).
// depart_reminded_at으로 중복 발송 차단(멱등). Vercel Hobby cron 한도와 무관(외부 트리거).
const WINDOW_HOURS = 24;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const now = Date.now();
  const windowMs = WINDOW_HOURS * 60 * 60 * 1000;

  // 미발송 paid 매칭 + 관련 지구/학생 식별자. 출발 윈도우는 아래 JS에서 필터(출발 전에만).
  const { data: matches } = await db
    .from("matches")
    .select(
      `id, trip_id, request_id, depart_reminded_at,
       trip:trips!trip_id(departure_at, created_by),
       request:seat_requests!request_id(operator_id),
       match_passengers(id)`,
    )
    .eq("status", "paid")
    .is("depart_reminded_at", null);

  let reminded = 0;
  let failed = 0;

  for (const m of matches ?? []) {
    const trip = one(m.trip);
    const departAt = trip?.departure_at;
    if (!departAt) continue;
    const depMs = new Date(departAt).getTime();
    // 출발 전에만 + 24h 이내
    if (!(depMs > now && depMs <= now + windowMs)) continue;

    const supplyOperatorId = trip?.created_by ?? null;
    const requestOperatorId = one(m.request)?.operator_id ?? null;
    const passengerId = (m.match_passengers ?? [])[0]?.id ?? null;

    try {
      await emit(
        "depart_d1",
        { supplyOperatorId, requestOperatorId, passengerId },
        { tripId: m.trip_id, departureAt: departAt },
      );
      // 멱등 마킹 — 동시 실행에도 1회만(조건부 update).
      await db
        .from("matches")
        .update({ depart_reminded_at: new Date(now).toISOString() })
        .eq("id", m.id)
        .is("depart_reminded_at", null);
      reminded++;
    } catch {
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`[cron/depart-reminder] ${failed}건 실패 (다음 실행 재시도)`);
  }
  return NextResponse.json({ ok: true, reminded, failed });
}
