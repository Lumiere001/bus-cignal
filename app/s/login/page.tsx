// 학생 로그인 안내 — CCC 계정으로 로그인하면 본인 정보(이름·전화·출신지구)까지 받아와
// 바로 신청·예약 확인이 가능. (예약번호 /r 경로는 그대로 별도 유지.)

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const CCC_ERRORS: Record<string, string> = {
  ccc_access_denied: "동의를 취소하셨어요. 다시 시도해 주세요.",
  ccc_is_staff:
    "간사 계정으로 로그인하셨어요. 간사는 간사 로그인(/login)을 이용해 주세요.",
  ccc_not_student: "학생 계정만 이용할 수 있어요.",
  ccc_state: "보안 검증에 실패했어요(세션 만료/위조 의심). 처음부터 다시 시도해 주세요.",
  ccc_invalid_or_expired_code: "로그인 코드가 만료되었어요. 다시 시도해 주세요.",
};

function ccErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error in CCC_ERRORS) return CCC_ERRORS[error];
  if (error.startsWith("ccc_")) return "로그인 중 오류가 발생했어요. 다시 시도해 주세요.";
  return null;
}

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const cccMsg = ccErrorMessage(error);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-5 p-6">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">학생 로그인</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          CCC 계정으로 로그인하면 본인 정보로 바로 차량을 신청하고 예약을 확인할 수
          있어요.
        </p>
      </div>

      {cccMsg && (
        <p
          role="alert"
          className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm"
        >
          {cccMsg}
        </p>
      )}

      {/* ⚠️ 일반 <a>(top-level 전체 페이지 이동) — 설치형 PWA(특히 iOS)에서 CCC 외부
          동의→콜백 왕복이 같은 컨텍스트로 유지되어 세션 쿠키가 올바른 저장소에 들어가게 한다. */}
      <a
        href="/s/login/ccc"
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-[15px]")}
      >
        CCC 계정으로 로그인
      </a>

      <div className="bg-muted/40 rounded-xl border p-4 text-sm leading-relaxed">
        <p className="mb-1 font-medium">예약번호를 받으셨나요?</p>
        <p className="text-muted-foreground">
          간사님께 받은 예약번호가 있으면{" "}
          <Link href="/r" className="text-blue-600 hover:underline">
            예약 조회
          </Link>
          로 본인확인 후 확인할 수 있어요.
        </p>
      </div>

      <Link
        href="/guide"
        className="text-muted-foreground hover:text-foreground text-center text-sm underline-offset-4 hover:underline"
      >
        📖 처음이신가요? 사용 방법 보기
      </Link>
    </main>
  );
}
