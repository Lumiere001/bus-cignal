import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emit } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// 송금 지연 리마인더 — v1.1: 자동 만료 아님(자리 회수 X), 알림만. SPEC §7·§9.10.
const REMINDER_HOURS = 24;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();
  const cutoff = new Date(
    Date.now() - REMINDER_HOURS * 60 * 60 * 1000,
  ).toISOString();

  // 매칭됐지만 송금 미보고 + 일정 시간 경과 → 송금 장기 지연 알림 (SPEC §8: 양쪽 지구)
  const { data: stale } = await db
    .from("matches")
    .select("id, request_id, trip_id")
    .eq("status", "awaiting_payment")
    .lt("matched_at", cutoff);

  let reminded = 0;
  for (const m of stale ?? []) {
    // 신청 지구 간사 = 신청자, 공급 지구 간사 = trip 생성자
    const [{ data: req }, { data: trip }] = await Promise.all([
      db
        .from("seat_requests")
        .select("operator_id")
        .eq("id", m.request_id)
        .maybeSingle(),
      db.from("trips").select("created_by").eq("id", m.trip_id).maybeSingle(),
    ]);
    if (req?.operator_id || trip?.created_by) {
      await emit(
        "payment_delay",
        {
          supplyOperatorId: trip?.created_by ?? null,
          requestOperatorId: req?.operator_id ?? null,
        },
        { matchId: m.id },
      );
      reminded++;
    }
  }
  return NextResponse.json({ ok: true, reminded });
}
