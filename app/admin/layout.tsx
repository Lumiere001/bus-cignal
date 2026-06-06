import { redirect } from "next/navigation";
import { clearMasterSession } from "@/lib/auth/master";
import { Logo } from "@/components/brand/logo";
import { ScrollNav, type NavItem } from "@/components/nav/scroll-nav";

// 마스터 영역 공용 셸 — 상단 브랜드 바 + 가로 스크롤 네비 + 로그아웃.
// ⚠️ 접근 보호는 middleware.ts(/admin/* → 마스터 세션 검증)가 담당. 여기선 UI만.

const NAV: NavItem[] = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/operators", label: "간사" },
  { href: "/admin/operators/pending", label: "승인 대기" },
  { href: "/admin/trips", label: "차량" },
  { href: "/admin/matches", label: "매칭" },
  { href: "/admin/settlement", label: "정산" },
  { href: "/admin/rejections", label: "거절" },
  { href: "/admin/system", label: "시스템" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  async function logout() {
    "use server";
    await clearMasterSession();
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-card/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2">
              <Logo size="sm" href="/admin" />
              <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-bold">
                마스터
              </span>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-destructive text-sm transition-colors"
              >
                로그아웃
              </button>
            </form>
          </div>
          <div className="pb-2">
            <ScrollNav items={NAV} />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
