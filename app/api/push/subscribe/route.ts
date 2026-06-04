import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOperatorSession } from "@/lib/auth/operator";
import { getPassengerSession } from "@/lib/auth/passenger";

export const dynamic = "force-dynamic";

/**
 * 푸시 구독 등록/해제 — Phase C 클라이언트가 FCM getToken 후 호출. SPEC §9.3 · §S8.
 *  - POST: 현재 세션(간사 또는 학생)에 토큰 묶어 저장(upsert). 옵트인.
 *  - DELETE: 본인 소유 토큰 해제.
 * 소유자는 세션에서 결정 — 클라이언트가 operator_id/passenger_id를 보낼 수 없다(위변조 차단).
 */

const SubscribeBody = z.object({
  token: z.string().min(20).max(4096),
  userAgent: z.string().max(512).optional(),
});

const UnsubscribeBody = z.object({
  token: z.string().min(20).max(4096),
});

type Owner =
  | { operator_id: string; passenger_id: null }
  | { operator_id: null; passenger_id: string };

async function currentOwner(): Promise<Owner | null> {
  const op = await getOperatorSession();
  if (op) return { operator_id: op.operatorId, passenger_id: null };
  const pa = await getPassengerSession();
  if (pa) return { operator_id: null, passenger_id: pa.passengerId };
  return null;
}

export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = SubscribeBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = createAdminClient();
  // 같은 기기 토큰이 다른 소유자에 묶여 있을 수 있음(공용 기기·재로그인) → 소유자 재지정 + last_used 갱신.
  const { error } = await db.from("push_subscriptions").upsert(
    {
      operator_id: owner.operator_id,
      passenger_id: owner.passenger_id,
      token: parsed.data.token,
      user_agent: parsed.data.userAgent ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = UnsubscribeBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = createAdminClient();
  // 본인 소유 토큰만 해제(타 소유자 토큰 삭제 방지).
  const base = db
    .from("push_subscriptions")
    .delete()
    .eq("token", parsed.data.token);
  await (owner.operator_id !== null
    ? base.eq("operator_id", owner.operator_id)
    : base.eq("passenger_id", owner.passenger_id));
  return NextResponse.json({ ok: true });
}
