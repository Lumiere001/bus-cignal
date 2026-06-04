import Link from "next/link";
import { redirect } from "next/navigation";
import { clearMasterSession } from "@/lib/auth/master";

// 마스터 영역 공용 셸 — 상단 네비 + 로그아웃.
// ⚠️ 접근 보호는 middleware.ts(/admin/* → 마스터 세션 검증)가 담당. 여기선 UI만.

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/operators", label: "간사" },
  { href: "/admin/operators/pending", label: "승인 대기" },
  { href: "/admin/trips", label: "Trip" },
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
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground mr-2 font-semibold">마스터</span>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-primary transition-colors">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-destructive text-sm transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
