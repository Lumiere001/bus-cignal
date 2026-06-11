import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import {
  OPERATOR_COOKIE,
  verifyOperatorToken,
} from "@/lib/auth/operator-session";
import { STUDENT_COOKIE, verifyStudentToken } from "@/lib/auth/student-session";

export default async function Home() {
  // QR(랜딩 직링크) 재방문: 이미 로그인된 사용자는 본인 화면으로 바로 보낸다
  // (간사 보고 2026-06-11 — 학생이 로그인했는데도 QR로 오면 랜딩에 멈춤).
  // 세션 쿠키는 브라우저 컨텍스트별이라 iOS 설치형 PWA↔Safari·인앱 브라우저 간엔
  // 공유되지 않음 — 그 경우는 비로그인과 동일하게 랜딩을 보여준다(아래).
  const jar = await cookies();
  if (await verifyOperatorToken(jar.get(OPERATOR_COOKIE)?.value)) {
    redirect("/operator");
  }
  if (await verifyStudentToken(jar.get(STUDENT_COOKIE)?.value)) {
    redirect("/s");
  }

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
            href="/s/login"
            className={cn(buttonVariants({ size: "lg" }), "h-12 w-full bg-blue-600 text-[15px] hover:bg-blue-700")}
          >
            학생 로그인 →
          </Link>
          <Link
            href="/r"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full bg-card text-[15px]")}
          >
            예약번호로 조회
          </Link>
          <Link
            href="/status"
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-12 w-full text-[15px]")}
          >
            전국 잔여석 현황 →
          </Link>
        </div>
      </section>

      <footer className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-center text-xs">
        <Link href="/guide" className="hover:text-foreground underline-offset-4 hover:underline">
          📖 사용 가이드
        </Link>
        <span>CCC IT 사역부 · 2026 여름 수련회</span>
      </footer>
    </main>
  );
}
