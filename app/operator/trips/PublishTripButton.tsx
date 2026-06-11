"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publishTrip } from "./actions";

export function PublishTripButton({ tripId }: { tripId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await publishTrip(tripId);
      if (result?.error) {
        setError(result.error);
        setConfirming(false);
      }
      // 성공 시 publishTrip이 redirect → 별도 닫기 불필요
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={() => setConfirming(true)} disabled={isPending}>
        타지구 공개
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !isPending && setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">타지구에 공개할까요?</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              공개하면 다른 지구가 이 차량을 신청할 수 있어요. 학생이 <b>한 명이라도 매칭되면</b>{" "}
              일정·정원·계좌 등 차량 정보를 <b>더 이상 수정할 수 없습니다</b>. 공개 전에 정보를 한 번
              더 확인해주세요.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              (매칭 전까지는 ‘차량 수정’으로 언제든 고칠 수 있어요.)
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={isPending}
              >
                더 확인하기
              </Button>
              <Button size="sm" onClick={publish} disabled={isPending}>
                {isPending ? "공개중..." : "공개하기"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
