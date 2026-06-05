import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutOperator } from "@/lib/auth/logout";
import { isMaintenanceMode } from "@/lib/system-config";

// 간사(operator) 공용 셸 — 상단 네비 + 로그아웃.
// 접근 보호는 middleware(/operator/* → operator 세션). 여기선 UI + 점검 모드 차단.

// 점검 모드 체크(isMaintenanceMode)가 admin client(DB)를 호출하므로, 빌드 타임 prerender에서
// 빈 env로 createAdminClient가 throw됨(supabaseUrl is required). operator 셸은 항상 인증·동적이라
// force-dynamic으로 prerender를 막는다.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/operator", label: "대시보드" },
  { href: "/operator/trips", label: "내 차량" },
  { href: "/operator/requests", label: "신청" },
  { href: "/operator/matches", label: "매칭" },
  { href: "/operator/settlement", label: "정산" },
  { href: "/operator/profile", label: "내 정보" },
];

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  async function logout() {
    "use server";
    await logoutOperator();
    redirect("/login");
  }

  // 점검 모드(마스터 설정) on이면 간사 화면 전체 차단 — 안내만 노출.
  // (마스터는 별도 /admin 영역으로 접근해 점검 모드를 끌 수 있음)
  const maintenance = await isMaintenanceMode();

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
      <div className="flex-1">
        {maintenance ? (
          <div className="mx-auto max-w-md px-4 py-20 text-center">
            <p className="text-2xl">🛠️</p>
            <h1 className="mt-3 text-lg font-semibold">시스템 점검 중입니다</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              현재 관리자가 시스템을 점검하고 있습니다. 잠시 후 다시 이용해 주세요.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
