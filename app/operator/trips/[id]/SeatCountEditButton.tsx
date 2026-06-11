"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { editSeatOffer } from "./actions";

/**
 * 정원(= 타지구에 공개하는 좌석) 변경 — draft/published 차량에서만 렌더(page.tsx 가드).
 * 공개 좌석 수를 조정한다. 이미 매칭된 인원(matched) 이상, 등록 최대(capacity) 이하.
 * 표시 잔여 = 공개 좌석 − 활성 매칭. ('정원' = 다른 지구에 공개하는 좌석 개념, 2026-06-11)
 */
export function SeatCountEditButton({
  tripId,
  currentCount,
  matched,
  capacity,
}: {
  tripId: string;
  currentCount: number;
  matched: number;
  capacity: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // 문자열 상태 — 완전히 비울 수 있게(빈 값이 0으로 강제되지 않도록).
  const [count, setCount] = useState<string>(String(currentCount));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const min = Math.max(1, matched);
  const num = count.trim() === "" ? NaN : Number(count);
  const valid = Number.isInteger(num) && num >= min && num <= capacity;

  function submit() {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const result = await editSeatOffer(tripId, num);
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
          setCount(String(currentCount));
          setOpen(true);
        }}
      >
        정원(공개 좌석) 변경
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
              <h3 className="text-base font-semibold">정원(공개 좌석) 변경</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                다른 지구에 공개하는 좌석 수(정원)를 조정합니다. 이미 매칭된 {matched}명 이상,
                등록 최대 {capacity}석 이하로만 가능해요. (확정된 매칭 인원은 줄일 수 없어요.)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="seat-count" className="text-sm font-medium">
                정원
              </label>
              <input
                id="seat-count"
                type="number"
                inputMode="numeric"
                min={min}
                max={capacity}
                value={count}
                onChange={(e) => setCount(e.target.value)}
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
                disabled={isPending || !valid}
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
