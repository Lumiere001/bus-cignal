"use client";

import { useState, useTransition } from "react";
import { revokeOperator } from "./actions";

// SPEC §5.10 — 비활성화는 권한 즉시 회수 + 양쪽 알림 발송이라 되돌리기 어려움.
// → 사유(5자+) 입력 + 확인 단계를 강제하는 인라인 모달.

export function RevokeButton({ operatorId, name }: { operatorId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (reason.trim().length < 5) {
      setError("해제 사유를 5자 이상 입력하세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await revokeOperator(operatorId, reason);
        setOpen(false);
        setReason("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "비활성화에 실패했습니다.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-md border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors"
      >
        비활성화
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background w-full max-w-md space-y-4 rounded-xl border p-5 shadow-lg">
        <div>
          <h2 className="font-semibold">{name} 권한 비활성화</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            권한이 즉시 회수되고 세션이 종료됩니다. 본인과 같은 지구 간사에게 알림이 발송됩니다.
          </p>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="해제 사유 (5자 이상) — 알림에 활용"
          rows={3}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            disabled={pending}
            className="hover:bg-muted rounded-lg px-4 py-2 text-sm whitespace-nowrap transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {pending ? "처리 중…" : "비활성화 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}
