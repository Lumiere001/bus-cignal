import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutOperator } from "@/lib/auth/logout";

// 간사(operator) 공용 셸 — 상단 네비 + 로그아웃.
// 접근 보호는 middleware(/operator/* → operator 세션). 여기선 UI만.

const NAV = [
  { href: "/operator", label: "대시보드" },
  { href: "/operator/trips", label: "내 차량" },
  { href: "/operator/requests", label: "신청" },
  { href: "/operator/matches", label: "매칭" },
  { href: "/operator/settlement", label: "정산" },
  { href: "/operator/profile", label: "내 정보" },
];

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  async function logout() {
    "use server";
    await logoutOperator();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground mr-1 font-semibold">간사</span>
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
      <div className="flex-1">{children}</div>
    </div>
  );
}
