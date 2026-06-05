import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* 상단 브랜드 바 */}
      <header className="flex items-center justify-between px-5 pt-5">
        <Logo />
        <StatusPill tone="success">● 매칭 오픈</StatusPill>
      </header>

      {/* 히어로 */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-primary to-blue-700 text-4xl shadow-xl shadow-primary/40">
          🚌
        </div>
        {/* 노선 모티프 */}
        <div
          className="mb-6 w-28 rounded-full opacity-30"
          style={{
            height: 2,
            background:
              "repeating-linear-gradient(90deg, var(--color-primary) 0 8px, transparent 8px 16px)",
          }}
          aria-hidden
        />
        <h1 className="text-[2.6rem] leading-[1.08] font-extrabold tracking-tight">
          First,
          <br />
          No matter what
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xs text-[15px] leading-relaxed text-balance">
          CCC 전국 여름 수련회 — 지구 간 차량 매칭·정산·소통을 한 곳에서.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <StatusPill tone="info">⚖️ 공정한 매칭</StatusPill>
          <StatusPill tone="success">🧾 투명한 정산</StatusPill>
          <StatusPill tone="warning">🔔 실시간 알림</StatusPill>
        </div>

        <div className="mt-9 flex w-full max-w-xs flex-col gap-3">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-[15px]")}>
            간사 로그인 →
          </Link>
          <Link
            href="/r"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full bg-card text-[15px]")}
          >
            예약 조회
          </Link>
        </div>
      </section>

      <footer className="text-muted-foreground py-6 text-center text-xs">
        CCC IT 사역부 · 2026 여름 수련회
      </footer>
    </main>
  );
}
