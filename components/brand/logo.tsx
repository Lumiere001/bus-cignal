import Link from "next/link";
import { cn } from "@/lib/utils";

/** Bus Cignal 워드마크 — 🚌 엠블럼 + 텍스트. (warm-trust 브랜드 정체성) */
export function Logo({
  href = "/",
  size = "md",
  className,
}: {
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const emblem = size === "sm" ? "h-7 w-7 text-sm" : "h-8 w-8 text-base";
  const text = size === "sm" ? "text-base" : "text-lg";
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-extrabold tracking-tight",
        className,
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-sm shadow-primary/40",
          emblem,
        )}
        aria-hidden
      >
        🚌
      </span>
      <span className={text}>Bus Cignal</span>
    </Link>
  );
}
