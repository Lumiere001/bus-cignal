"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cancelStudentRequest } from "./actions";

/** 대기(queued) 신청 본인 취소 — 확인 → cancelStudentRequest → 새로고침. */
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelStudentRequest(requestId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-gray-400 hover:text-rose-600"
      >
        신청 취소
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">취소할까요?</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={isPending}
        >
          아니요
        </Button>
        <Button size="sm" onClick={handleCancel} disabled={isPending}>
          {isPending ? "취소중..." : "취소"}
        </Button>
      </div>
    </div>
  );
}
