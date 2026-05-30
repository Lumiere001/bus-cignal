import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 수련회 종료 + 90일 후 개인정보 익명화 (매일 새벽 3시 KST). SPEC §10.3·§15.
// 보관 마감일 = system_config 'anonymize_after' (ISO 날짜). 미설정 시 skip.

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}

function sha(v: string | null): string | null {
  return v ? createHash("sha256").update(v).digest("hex") : null;
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

  const { data: rps } = await db
    .from("request_passengers")
    .select("id, phone")
    .eq("anonymized", false);
  for (const r of rps ?? []) {
    await db
      .from("request_passengers")
      .update({ name: "○○○", phone: sha(r.phone) ?? "", anonymized: true })
      .eq("id", r.id);
    anonymized++;
  }

  const { data: mps } = await db
    .from("match_passengers")
    .select("id, phone")
    .eq("anonymized", false);
  for (const m of mps ?? []) {
    await db
      .from("match_passengers")
      .update({ name: "○○○", phone: sha(m.phone) ?? "", anonymized: true })
      .eq("id", m.id);
    anonymized++;
  }

  const { data: ops } = await db
    .from("operators")
    .select("id, phone, email")
    .eq("anonymized", false);
  for (const o of ops ?? []) {
    await db
      .from("operators")
      .update({
        name: "○○○",
        phone: sha(o.phone),
        email: sha(o.email),
        anonymized: true,
      })
      .eq("id", o.id);
    anonymized++;
  }

  return NextResponse.json({ ok: true, anonymized });
}
