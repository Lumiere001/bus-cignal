"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelTrip } from "./actions";

/**
 * 차량(Trip) 취소 버튼 — draft/published 차량에서만 렌더(page.tsx 가드).
 * blockedReason 이 있으면(활성 매칭 존재) 버튼 비활성 + 사유 표시.
 * 확정 시 cancelTrip → 성공하면 차량 목록으로 이동.
 */
export function TripCancelButton({
  tripId,
  blockedReason,
}: {
  tripId: string;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await cancelTrip(tripId, reason);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.push("/operator/trips");
      router.refresh();
    });
  }

  return (
    <div className="mt-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={blockedReason !== null}
        className="border-rose-200 text-rose-600 hover:bg-rose-50"
      >
        차량 취소
      </Button>
      {blockedReason && (
        <p className="text-muted-foreground mt-1 text-xs">{blockedReason}</p>
      )}

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
              <h3 className="text-base font-semibold">차량 취소</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                이 차량을 취소하면 공개가 종료되고, 대기 중인 신청도 함께 취소됩니다(신청
                지구에 재신청 안내가 갑니다). 이미 매칭된 학생이 있으면 취소할 수 없어요.
                계속할까요?
              </p>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="취소 사유 (선택)"
              rows={3}
              maxLength={500}
              disabled={isPending}
              aria-label="차량 취소 사유 (선택)"
              className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
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
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={isPending}
              >
                {isPending ? "취소 중…" : "차량 취소 확정"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
