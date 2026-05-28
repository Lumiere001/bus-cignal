import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
          🚌 출시 준비 중
        </span>
        <h1 className="text-4xl font-bold tracking-tight">Bus Cignal</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          CCC 전국 여름 수련회 타지구 차량 매칭·정산·소통 통합 시스템. 지구 간 차량 자리를 공정하고
          투명하게.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          간사 로그인
        </Link>
        <Link href="/r" className={buttonVariants({ variant: "outline", size: "lg" })}>
          예약 조회
        </Link>
      </div>
    </main>
  );
}
