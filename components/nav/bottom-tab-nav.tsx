"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string; icon: string };

/**
 * 모바일 하단 고정 탭바 — 줄바꿈으로 무너지던 상단 nav(P3)를 대체.
 * 데스크톱(md+)에서는 숨김(상단 nav 사용). 첫 항목은 섹션 루트로 정확 매칭.
 */
export function BottomTabNav({ items }: { items: TabItem[] }) {
  const pathname = usePathname();
  const rootHref = items[0]?.href;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-1 pt-1.5">
        {items.map((it) => {
          const active =
            pathname === it.href ||
            (it.href !== rootHref && pathname.startsWith(it.href + "/"));
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-[56px] flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {it.icon}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
