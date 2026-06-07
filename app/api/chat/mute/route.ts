import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveChatAccess } from "@/lib/chat/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMuteState, setMuteState } from "@/lib/chat/mutes";

export const dynamic = "force-dynamic";

/**
 * 채팅방(trip) 푸시 음소거 토글 — `/chat/:tripId` 채팅 헤더가 호출. 보안점검 Finding 3.
 *
 * ★ 보안 경계 (/api/chat/token·notify 와 동일):
 *  - 클라이언트는 tripId(+POST 시 muted)만 보낸다. role·subjectId는 신뢰하지 않는다.
 *  - 권한·신원은 서버가 현재 세션 + Supabase 조회로만 판단(resolveChatAccess).
 *  - 음소거는 **푸시만** 끈다 — 인앱 알림(notifications in_app)은 유지(lib/chat/notify.ts).
 */

// token 라우트와 동일: hex 8-4-4-4-12 형태만 확인(.uuid()는 seed/dev id 거부).
const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET ?tripId=... → 현재 음소거 상태 { muted }. */
export async function GET(req: Request) {
  const tripId = new URL(req.url).searchParams.get("tripId") ?? "";
  if (!UUID_SHAPED.test(tripId)) {
    return NextResponse.json({ error: "invalid_trip" }, { status: 400 });
  }

  const access = await resolveChatAccess(tripId);
  if (!access) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const muted = await getMuteState(createAdminClient(), access.tripId, {
    role: access.role,
    subjectId: access.subjectId,
  });
  return NextResponse.json({ muted });
}

const PostBody = z
  .object({
    tripId: z.string().regex(UUID_SHAPED),
    muted: z.boolean(),
  })
  .strict();

/** POST { tripId, muted } → 음소거 토글 설정. */
export async function POST(req: Request) {
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const access = await resolveChatAccess(parsed.data.tripId);
  if (!access) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await setMuteState(
      createAdminClient(),
      access.tripId,
      { role: access.role, subjectId: access.subjectId },
      parsed.data.muted,
    );
  } catch {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, muted: parsed.data.muted });
}
