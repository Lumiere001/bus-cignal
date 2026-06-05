"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

/**
 * 가로 스크롤 탭 네비 — 섹션이 많은 영역(admin 8개)에서 줄바꿈(P3) 대신 한 줄 스크롤.
 * 활성 판정은 "가장 긴 일치 prefix"가 이김 (예: /admin/operators/pending 에서 승인대기만 활성).
 */
export function ScrollNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  let bestHref: string | null = null;
  for (const it of items) {
    const match = pathname === it.href || pathname.startsWith(it.href + "/");
    if (match && (bestHref === null || it.href.length > bestHref.length)) {
      bestHref = it.href;
    }
  }

  return (
    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav className="flex w-max items-center gap-1 text-sm">
        {items.map((it) => {
          const active = it.href === bestHref;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 font-semibold whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
