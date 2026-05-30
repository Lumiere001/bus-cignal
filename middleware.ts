import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { MASTER_COOKIE, verifyMasterToken } from "@/lib/auth/master-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 마스터 영역 보호 (/admin/login 제외) — 세션 없으면 로그인으로
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const valid = await verifyMasterToken(request.cookies.get(MASTER_COOKIE)?.value);
    if (!valid) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // Supabase 세션 갱신 (operator 인증 기반)
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
