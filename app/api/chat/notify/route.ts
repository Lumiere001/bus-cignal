import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveChatAccess } from "@/lib/chat/access";
import { notifyChatMessage } from "@/lib/chat/notify";

export const dynamic = "force-dynamic";

/**
 * 채팅 새 메시지 알림 발송 — `/chat/:tripId` 클라이언트가 메시지를 Firestore에 쓴 **직후**
 * fire-and-forget로 호출한다. SPEC §8 chat_message.
 *
 * ★ 보안 경계 (/api/chat/token 과 동일):
 *  - 클라이언트는 **tripId만** 보낸다. role·subjectId 등은 .strict()로 400 거부.
 *  - 권한·보낸 사람 식별은 서버가 현재 세션 + Supabase 조회로만 판단(resolveChatAccess).
 *  - 이 라우트는 메시지를 보내지 않는다(그건 클라이언트→Firestore). 알림만 fan-out.
 *  - best-effort: 부분 실패는 삼키고 항상 200. 알림은 secondary — 채팅을 막지 않는다.
 */

// token 라우트와 동일: Zod .uuid()는 seed/dev id를 거부하므로 형태(hex 8-4-4-4-12)만 확인.
const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Body = z
  .object({
    tripId: z.string().regex(UUID_SHAPED),
    preview: z.string().max(500).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // 현재 세션 + Supabase 조회만으로 권한·신원 판단 (클라이언트 입력 신뢰 안 함).
  // /api/chat/token 과 정확히 같은 식별 로직 — 채팅 참여자가 아니면 알림 권한도 없음.
  const access = await resolveChatAccess(parsed.data.tripId);
  if (!access) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 미리보기 문구 정제 — 줄바꿈·연속 공백 단일화 후 80자로 제한(알림 카드 표시용).
  const preview = parsed.data.preview
    ? parsed.data.preview.replace(/\s+/g, " ").trim().slice(0, 80)
    : undefined;

  // 보낸 사람 = 현재 세션 신원. notify 헬퍼가 이 사람을 수신자에서 제외한다.
  // 발송 실패는 전부 헬퍼 내부에서 삼킨다(best-effort) — 채팅은 영향 없음.
  try {
    await notifyChatMessage(
      access.tripId,
      { role: access.role, subjectId: access.subjectId },
      preview,
    );
  } catch {
    // 예기치 못한 오류도 삼킨다 — 알림은 secondary, 항상 200.
  }

  return NextResponse.json({ ok: true });
}
