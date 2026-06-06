import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveChatAccess } from "@/lib/chat/access";
import { chatAuth, isChatAdminConfigured } from "@/lib/firebase/chat-admin";

export const dynamic = "force-dynamic";

/**
 * 채팅 Custom Token 발급 — `/chat/:tripId` 클라이언트가 Firestore 입장 전 호출. SPEC §9.2.
 *
 * ★ 보안 경계:
 *  - 클라이언트는 **tripId만** 보낸다. 그 외 필드(role·subjectId 등)는 .strict()로 400 거부.
 *  - 권한은 서버가 현재 세션(passenger/operator) + Supabase 조회로만 판단(resolveChatAccess).
 *  - Custom Token claim은 단일 trip에 scope: { role, tripId, subjectId }.
 *  - Admin key 값은 응답·로그에 절대 포함하지 않는다.
 */

// Postgres UUID-shaped 검증. Zod .uuid()는 RFC 4122 version/variant까지 강제해
// seed/dev의 trip id(예: c0000000-0000-0000-0000-000000000012)를 거부하므로 사용 불가.
// DB에 존재하는 id를 권한 검증 단계로 넘기기 위해 형태(hex 8-4-4-4-12)만 확인한다.
const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// .strict() — tripId 외 필드(role·subjectId·passengerId·regionId·displayName 등)가
// 오면 무시하지 않고 400으로 거부한다. "클라이언트는 tripId만 보낼 수 있다"(TASK §3) 강제.
const Body = z
  .object({
    tripId: z.string().regex(UUID_SHAPED),
  })
  .strict();

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // 현재 세션 + Supabase 조회만으로 권한 판단 (클라이언트 입력 신뢰 안 함)
  const access = await resolveChatAccess(parsed.data.tripId);
  if (!access) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Firebase Admin 미설정(로컬·미구성 프리뷰) → 클라이언트가 fallback 안내
  if (!isChatAdminConfigured()) {
    return NextResponse.json({ error: "chat_unconfigured" }, { status: 503 });
  }

  // UID는 역할+subject로 결정(클라이언트 입력 아님). claim도 서버가 채운다.
  const uid = `${access.role}:${access.subjectId}`;
  let token: string;
  try {
    token = await chatAuth().createCustomToken(uid, {
      role: access.role,
      tripId: access.tripId,
      subjectId: access.subjectId,
    });
  } catch {
    // 키 오설정 등 — 상세/키 값 노출 없이 일반 오류만
    return NextResponse.json({ error: "token_failed" }, { status: 500 });
  }

  return NextResponse.json({
    token,
    role: access.role,
    subjectId: access.subjectId,
    displayName: access.displayName,
    tripId: access.tripId,
  });
}
