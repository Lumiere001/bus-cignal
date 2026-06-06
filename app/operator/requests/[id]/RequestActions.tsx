"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cancelRequest } from "../actions";

// 대기(queued)·매칭 없음 신청에서만 렌더 (page.tsx canModify 가드).
// [신청 수정] → /edit, [신청 취소] → 확인 모달(사유 선택) → cancelRequest.
export function RequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelRequest(requestId, reason);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // 성공 → 목록으로 이동(취소된 신청 상세에 머무를 이유 없음).
      router.push("/operator/requests");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border p-4">
      <h2 className="mb-3 text-sm font-semibold">신청 관리</h2>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/operator/requests/${requestId}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          신청 수정
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          신청 취소
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        대기 중인 신청만 수정·취소할 수 있어요. 매칭이 진행되면 공급 지구 간사와 협의가 필요합니다.
      </p>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="bg-background w-full max-w-md space-y-4 rounded-xl border p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold">신청 취소</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                신청을 취소하면 공급 지구 대기 큐에서 제거됩니다. 계속할까요?
              </p>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="취소 사유 (선택)"
              rows={3}
              maxLength={500}
              disabled={isPending}
              className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                disabled={isPending}
              >
                닫기
              </Button>
              <Button size="sm" onClick={submitCancel} disabled={isPending}>
                {isPending ? "취소 중…" : "신청 취소 확정"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
