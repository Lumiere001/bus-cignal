"use client";

import { useState, useTransition } from "react";
import { approveOperator, rejectOperator } from "../actions";

// 승인/거절 버튼 — 서버 액션 호출 + 진행 중 비활성화 + 에러 표시.
// 신청 지구가 없으면 승인 불가(배정할 지구 없음) → 버튼 비활성화.

export function PendingActions({
  operatorId,
  hasRegion,
}: {
  operatorId: string;
  hasRegion: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: (id: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn(operatorId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run(rejectOperator)}
          disabled={pending}
          className="hover:bg-muted rounded-md border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50"
        >
          거절
        </button>
        <button
          type="button"
          onClick={() => run(approveOperator)}
          disabled={pending || !hasRegion}
          title={hasRegion ? undefined : "신청 지구가 없어 승인할 수 없습니다"}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-50"
        >
          {pending ? "처리 중…" : "승인"}
        </button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
