// 간사 로그인 — CCC Summer 신원 핸드오프(권장) + 마스터 매직링크(전환기 fallback).
// 공개 로그인 폼 없음(간사 명단·지구는 PII). CCC 로그인은 /login/ccc → ccc-summer 동의.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ccc_<reason> 에러 → 사용자 안내 문구.
const CCC_ERRORS: Record<string, string> = {
  ccc_access_denied: "동의를 취소하셨어요. 다시 시도해 주세요.",
  ccc_not_staff: "간사 계정만 입장할 수 있어요. (CCC에서 간사로 확인되지 않았습니다.)",
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

      {error === "invalid" && (
        <p
          role="alert"
          className="text-destructive bg-destructive/10 rounded-md px-3 py-2 text-sm"
        >
          입장 링크가 유효하지 않거나 만료되었습니다. 담당 마스터에게 링크 재발급을
          요청해 주세요.
        </p>
      )}

      <Link
        href="/login/ccc"
        prefetch={false}
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-[15px]")}
      >
        CCC 계정으로 로그인
      </Link>

      <div className="bg-muted/40 rounded-xl border p-4 text-sm leading-relaxed">
        <p className="mb-1 font-medium">CCC 로그인이 안 되시나요?</p>
        <p className="text-muted-foreground">
          담당 마스터(운영자)에게 <b>입장 링크</b>를 요청하시면 임시로 입장할 수
          있어요. 승인된 간사에게만 발급됩니다.
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
    </main>
  );
}
