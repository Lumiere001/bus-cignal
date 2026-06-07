"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { editSeatOffer } from "./actions";

// 차량 좌석 수 상한 — 트립 생성(actions.ts)의 1~200 제한과 동일.
const MAX_SEATS = 200;

/**
 * 공개 인원수(= 이 차량이 내놓는 좌석 = 정원) 변경 — draft/published 차량에서만 렌더(page.tsx 가드).
 * 변경하면 정원도 함께 바뀐다. 이미 매칭된 인원(matched) 이상, 최대 200석까지 조정 가능.
 */
export function SeatCountEditButton({
  tripId,
  currentCount,
  matched,
}: {
  tripId: string;
  currentCount: number;
  matched: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(currentCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const min = Math.max(1, matched);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await editSeatOffer(tripId, count);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setCount(currentCount);
          setOpen(true);
        }}
      >
        공개 인원 변경
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="bg-background w-full max-w-sm space-y-4 rounded-xl border p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold">공개 인원 변경</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                이 차량이 내놓는 좌석 수를 조정합니다.{" "}
                <b>변경하면 정원도 함께 바뀌어요.</b> 이미 매칭된 {matched}명 이상,
                최대 {MAX_SEATS}석까지 가능해요. (확정된 매칭 인원은 바뀌지 않습니다.)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="seat-count" className="text-sm font-medium">
                공개 인원
              </label>
              <input
                id="seat-count"
                type="number"
                inputMode="numeric"
                min={min}
                max={MAX_SEATS}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={isPending}
                className="border-input bg-background focus-visible:ring-ring w-24 rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              />
              <span className="text-muted-foreground text-sm">석</span>
            </div>
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
                disabled={isPending || count < min || count > MAX_SEATS}
              >
                {isPending ? "변경 중…" : "변경 저장"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
