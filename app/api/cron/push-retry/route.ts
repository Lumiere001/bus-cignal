import { NextResponse } from "next/server";
import { deliverPushBatch } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * 푸시 재시도 cron — pending push 중 백오프 시점이 된 row를 재발송. SPEC §8 · §9.5.
 *
 * ⚠️ Vercel Hobby는 cron 2개·하루 1회 한계 → 현재 payment-reminder·anonymize 2개로 가득.
 * 그래서 daily 구동은 payment-reminder cron에 piggyback(deliverPushBatch 호출)으로 보장하고,
 * 이 독립 라우트는 수동 트리거 + Pro 승급 시 vercel.json에 분리 cron으로 등록하는 용도다.
 * (1m/5m/30m 백오프는 더 잦은 cadence가 가능할 때 온전히 실현 — 그 전엔 daily가 최소 구동.)
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await deliverPushBatch();
  return NextResponse.json({ ok: true, ...summary });
}
