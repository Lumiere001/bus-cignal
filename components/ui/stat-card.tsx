import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "success" | "danger" | "neutral";

const TONE: Record<Tone, { ring: string; num: string; chip: string; glow: string; hint: string }> = {
  info: { ring: "border-border", num: "text-foreground", chip: "bg-blue-50", glow: "", hint: "text-muted-foreground" },
  danger: {
    ring: "border-red-200",
    num: "text-red-600",
    chip: "bg-red-100",
    glow: "bg-gradient-to-b from-red-50/70 to-card",
    hint: "text-red-600",
  },
  warning: {
    ring: "border-amber-200",
    num: "text-amber-600",
    chip: "bg-amber-100",
    glow: "bg-gradient-to-b from-amber-50/70 to-card",
    hint: "text-amber-600",
  },
  success: {
    ring: "border-green-200",
    num: "text-green-600",
    chip: "bg-green-100",
    glow: "bg-gradient-to-b from-green-50/70 to-card",
    hint: "text-green-600",
  },
  neutral: { ring: "border-border", num: "text-muted-foreground", chip: "bg-muted", glow: "", hint: "text-muted-foreground" },
};

/** 대시보드 통계 카드 — 시맨틱 색·아이콘·큰 숫자로 위계 부여 (warm-trust). */
export function StatCard({
  label,
  value,
  href,
  icon,
  tone = "info",
  hint,
}: {
  label: string;
  value: number | string;
  href: string;
  icon: string;
  tone?: Tone;
  hint?: string;
}) {
  const t = TONE[tone];
  return (
    <Link
      href={href}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
        t.ring,
        t.glow,
      )}
    >
      <div className={cn("mb-2 grid h-8 w-8 place-items-center rounded-lg text-base", t.chip)} aria-hidden>
        {icon}
      </div>
      <div className="text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-3xl font-extrabold tracking-tight tabular-nums", t.num)}>{value}</div>
      {hint && <div className={cn("mt-0.5 text-xs font-bold", t.hint)}>{hint}</div>}
    </Link>
  );
}
