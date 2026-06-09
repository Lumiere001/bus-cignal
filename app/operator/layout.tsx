import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutOperator } from "@/lib/auth/logout";
import { getOperatorSession } from "@/lib/auth/operator";
import { getOperatorRegionName } from "@/lib/auth/operator-region";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMaintenanceMode } from "@/lib/system-config";
import { Logo } from "@/components/brand/logo";
import { BottomTabNav, type TabItem } from "@/components/nav/bottom-tab-nav";

// 간사(operator) 공용 셸 — 상단 앱바(데스크톱 nav) + 모바일 하단 탭바 + 로그아웃.
// 접근 보호는 middleware(/operator/* → operator 세션). 여기선 UI + 점검 모드 차단.

// 점검 모드 체크(isMaintenanceMode)가 admin client(DB)를 호출하므로, 빌드 타임 prerender에서
// 빈 env로 createAdminClient가 throw됨(supabaseUrl is required). operator 셸은 항상 인증·동적이라
// force-dynamic으로 prerender를 막는다.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/operator", label: "대시보드", icon: "🏠" },
  { href: "/operator/trips", label: "지구 차량", icon: "🚌" },
  { href: "/operator/requests", label: "신청", icon: "📨" },
  { href: "/operator/matches", label: "매칭", icon: "🔗" },
  { href: "/operator/boarding", label: "탑승 학생", icon: "🚍" },
  { href: "/operator/settlement", label: "정산", icon: "🧾" },
  { href: "/operator/profile", label: "내 정보", icon: "👤" },
  { href: "/guide", label: "사용 가이드", icon: "📖" },
];
const TABS: TabItem[] = NAV.slice(0, 5); // 하단바 5개 (내 정보는 헤더 우측)

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  async function logout() {
    "use server";
    await logoutOperator();
    redirect("/login");
  }

  const maintenance = await isMaintenanceMode();

  // 상단에 로그인한 간사 이름 표시("내가 제대로 로그인했구나" 확인용). 이름은 세션에 없어 DB 조회.
  const session = await getOperatorSession();
  let operatorName: string | null = null;
  let regionName: string | null = null;
  if (session) {
    const db = createAdminClient();
    const { data: op } = await db
      .from("operators")
      .select("name")
      .eq("id", session.operatorId)
      .maybeSingle();
    operatorName = op?.name ?? null;
    if (session.regionId) regionName = await getOperatorRegionName(session.regionId);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-card/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-5">
            <Logo size="sm" href="/operator" />
            <nav className="hidden items-center gap-4 text-sm md:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {/* 로그인한 간사 이름 — "내가 제대로 로그인했구나" 확인용 (간사 요청) */}
            {operatorName && (
              <Link
                href="/operator/profile"
                className="flex min-w-0 items-center gap-1 text-sm"
                aria-label="내 정보"
              >
                <span className="bg-accent text-accent-foreground grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs">
                  👤
                </span>
                <span className="text-foreground max-w-[7.5rem] truncate font-medium">
                  {operatorName}
                  <span className="text-muted-foreground font-normal"> 간사</span>
                </span>
                {regionName && (
                  <span className="text-muted-foreground hidden text-xs sm:inline">
                    · {regionName}
                  </span>
                )}
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="text-muted-foreground hover:text-destructive text-sm transition-colors"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1 pb-24 md:pb-0">
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

      <BottomTabNav items={TABS} />
    </div>
  );
}
