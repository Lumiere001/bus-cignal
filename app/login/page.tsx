// 간사 로그인 — CCC Summer 신원 핸드오프(권장) + 마스터 매직링크(전환기 fallback).
// 공개 로그인 폼 없음(간사 명단·지구는 PII). CCC 로그인은 /login/ccc → ccc-summer 동의.

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  OPERATOR_COOKIE,
  verifyOperatorToken,
} from "@/lib/auth/operator-session";

// ccc_<reason> 에러 → 사용자 안내 문구.
const CCC_ERRORS: Record<string, string> = {
  ccc_access_denied: "동의를 취소하셨어요. 다시 시도해 주세요.",
  ccc_not_staff:
    "간사 계정이 아니에요. 학생이면 아래 ‘학생 로그인’으로 들어와 주세요.",
  ccc_region_unmapped:
    "소속 지구가 아직 시스템에 등록되지 않았어요. 담당 마스터에게 문의해 주세요.",
  ccc_revoked: "이 계정은 입장이 막혀 있어요. 담당 마스터에게 문의해 주세요.",
  ccc_state: "보안 검증에 실패했어요(세션 만료/위조 의심). 처음부터 다시 시도해 주세요.",
  ccc_invalid_or_expired_code:
    "로그인 코드가 만료되었어요. 다시 시도해 주세요.",
};

function ccErrorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "invalid") return null; // 매직링크 에러는 아래 별도 블록
  if (error in CCC_ERRORS) return CCC_ERRORS[error];
  if (error.startsWith("ccc_")) return "로그인 중 오류가 발생했어요. 다시 시도해 주세요.";
  return null;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // 이미 간사 세션이 있으면 다시 로그인 누를 필요 없이 바로 입장.
  const jar = await cookies();
  if (await verifyOperatorToken(jar.get(OPERATOR_COOKIE)?.value)) {
    redirect("/operator");
  }

  const cccMsg = ccErrorMessage(error);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">간사 로그인</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          CCC 계정으로 로그인하면 본인 지구로 바로 입장됩니다.
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

      {/* ⚠️ 일반 <a>(top-level 전체 페이지 이동) — Next <Link>(클라이언트 이동) 아님.
          CCC 외부 동의→콜백 왕복이 설치형 PWA(특히 iOS)에서 같은 브라우징 컨텍스트로
          유지돼 세션 쿠키가 올바른 저장소에 들어가게 한다(별도 Safari 컨텍스트 이탈 방지). */}
      <a
        href="/login/ccc"
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-[15px]")}
      >
        CCC 계정으로 로그인
      </a>

      <div className="bg-muted/40 rounded-xl border p-4 text-sm leading-relaxed">
        <p className="mb-1 font-medium">CCC 로그인이 안 되시나요?</p>
        <p className="text-muted-foreground">
          CCC에서 간사로 확인되지 않으면 입장할 수 없어요. 소속 지구·간사 등록을 담당
          마스터에게 확인해 주세요.
        </p>
      </div>

      {/* 학생 진입 — 간사가 아닌 학생 본인은 학생 로그인으로 */}
      <div className="border-t pt-5">
        <p className="text-muted-foreground mb-2 text-sm">학생이신가요?</p>
        <Link
          href="/s/login"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "bg-card h-12 w-full text-[15px]",
          )}
        >
          학생 로그인 →
        </Link>
      </div>

      {/* 사용 가이드 — 간사가 학생 신청 방법까지 한눈에 보고 안내할 수 있게 */}
      <Link
        href="/guide"
        className="text-muted-foreground hover:text-foreground text-center text-sm underline-offset-4 hover:underline"
      >
        📖 사용 가이드 (간사·학생 사용 방법)
      </Link>
    </main>
  );
}
