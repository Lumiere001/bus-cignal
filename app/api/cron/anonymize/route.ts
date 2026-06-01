import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  anonymizeMatchPassengerFields,
  anonymizeOperatorFields,
  anonymizeRequestPassengerFields,
} from "@/lib/anonymize";

export const dynamic = "force-dynamic";

// 수련회 종료 + 90일 후 개인정보 익명화 (매일 새벽 3시 KST = 18:00 UTC). SPEC §10.3·§15.
// 보관 마감일 = system_config 'anonymize_after' (ISO 날짜). 미설정 시 skip.
// 필드 스크럽 규칙·근거는 lib/anonymize.ts.

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();

  const { data: cfg } = await db
    .from("system_config")
    .select("value")
    .eq("key", "anonymize_after")
    .maybeSingle();
  if (!cfg?.value) {
    return NextResponse.json({ ok: true, skipped: "anonymize_after 미설정" });
  }
  if (new Date() < new Date(cfg.value)) {
    return NextResponse.json({ ok: true, skipped: "보관 기간 중" });
  }

  let anonymized = 0;
  let failed = 0;

  const { data: rps } = await db
    .from("request_passengers")
    .select("id, phone")
    .eq("anonymized", false);
  for (const r of rps ?? []) {
    const { error } = await db
      .from("request_passengers")
      .update(anonymizeRequestPassengerFields(r))
      .eq("id", r.id);
    if (error) failed++;
    else anonymized++;
  }

  const { data: mps } = await db
    .from("match_passengers")
    .select("id, phone")
    .eq("anonymized", false);
  for (const m of mps ?? []) {
    const { error } = await db
      .from("match_passengers")
      .update(anonymizeMatchPassengerFields(m))
      .eq("id", m.id);
    if (error) failed++;
    else anonymized++;
  }

  const { data: ops } = await db
    .from("operators")
    .select("id, phone, email")
    .eq("anonymized", false);
  for (const o of ops ?? []) {
    const { error } = await db
      .from("operators")
      .update(anonymizeOperatorFields(o))
      .eq("id", o.id);
    if (error) failed++;
    else anonymized++;
  }

  if (failed > 0) {
    console.error(`[cron/anonymize] ${failed}건 익명화 실패 (재시도는 다음 실행)`);
  }
  return NextResponse.json({ ok: true, anonymized, failed });
}
