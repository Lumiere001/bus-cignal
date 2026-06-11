"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatKstShort } from "@/lib/datetime";
import { approveRequest, declinePassengers } from "./actions";
import type { QueuePassenger } from "./MatchingQueue";

// 시간순 뷰의 1명 — 지구 묶음을 풀어 개인 단위로. requestId로 승인 시 다시 신청별로 묶는다.
export type FlatPassenger = QueuePassenger & {
  requestId: string;
  regionName: string;
  operatorName: string | null;
  operatorPhone: string | null;
  requesterKind: "student" | "operator";
};

/**
 * 시간순 대기 큐 — 지구를 가로질러 학생 개개인을 신청 시각으로 정렬해 보여준다(메인 뷰).
 * 선택은 개인 단위, 승인·거절은 서버 액션 제약상 신청(지구)별로 다시 묶어 순차 호출한다.
 */
export function TimeSortedQueue({
  tripId,
  availableSeats,
  flatQueue,
}: {
  tripId: string;
  availableSeats: number;
  flatQueue: FlatPassenger[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCount = selected.size;
  const overCapacity = selectedCount > availableSeats;

  function toggle(id: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 선택한 개인들을 신청(requestId)별로 묶음 — 승인·거절 모두 신청 단위 액션이라 필요.
  const selectedByRequest = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of flatQueue) {
      if (!selected.has(p.id)) continue;
      const arr = map.get(p.requestId) ?? [];
      arr.push(p.id);
      map.set(p.requestId, arr);
    }
    return map;
  }, [flatQueue, selected]);

  function handleApprove() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      // 신청별로 순차 승인 — 한 건이라도 실패하면 거기서 멈추고 안내(이미 처리된 건 큐 재조회로 반영).
      for (const [requestId, ids] of selectedByRequest) {
        const result = await approveRequest(tripId, requestId, ids);
        if ("error" in result) {
          setError(result.error);
          setSelected(new Set());
          router.refresh();
          return;
        }
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      for (const [requestId, ids] of selectedByRequest) {
        const result = await declinePassengers(tripId, requestId, ids, reason);
        if ("error" in result) {
          setError(result.error);
          setSelected(new Set());
          setRejecting(false);
          router.refresh();
          return;
        }
      }
      setSelected(new Set());
      setReason("");
      setRejecting(false);
      router.refresh();
    });
  }

  if (flatQueue.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
        대기 중인 신청이 없습니다.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          학생 {flatQueue.length}명 · {selectedCount}명 선택 · 신청 시각순
        </span>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSelected(
              selectedCount === flatQueue.length ? new Set() : new Set(flatQueue.map((p) => p.id)),
            );
          }}
          disabled={isPending || rejecting}
          className="text-xs font-medium text-blue-600 hover:underline disabled:text-gray-300"
        >
          {selectedCount === flatQueue.length ? "모두 해제" : "모두 선택"}
        </button>
      </div>

      <ol className="space-y-1.5">
        {flatQueue.map((p, idx) => {
          const checked = selected.has(p.id);
          return (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  checked ? "border-blue-400 bg-blue-50" : "border-gray-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  disabled={isPending}
                  className="accent-blue-600"
                />
                <span className="inline-flex h-5 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] text-gray-500 tabular-nums">
                  {idx + 1}
                </span>
                <span className="text-[11px] tabular-nums text-gray-500">
                  {formatKstShort(p.appliedAt)}
                </span>
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                  {p.regionName}
                </span>
                {p.requesterKind === "student" && (
                  <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                    학생 직접 신청
                  </span>
                )}
                {p.schoolOrRole && <span className="text-gray-400">{p.schoolOrRole}</span>}
                <a
                  href={`tel:${p.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto text-xs text-blue-600 hover:underline"
                >
                  {p.phone}
                </a>
              </label>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {overCapacity && !error && (
        <p className="mt-3 text-xs text-red-500">잔여 {availableSeats}석보다 많이 선택했습니다.</p>
      )}

      {rejecting && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
            선택한 <b>{selectedCount}명</b>을 각 신청에서 거절(제거)합니다. 사유는 선택이며 신청
            지구에 전달됩니다.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="거절 사유 (선택, 신청 지구에 전달됩니다)"
            disabled={isPending}
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        {rejecting ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejecting(false);
                setReason("");
                setError(null);
              }}
              disabled={isPending}
            >
              취소
            </Button>
            <Button size="sm" onClick={handleDecline} disabled={isPending || selectedCount === 0}>
              {isPending ? "처리중..." : `${selectedCount}명 거절`}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejecting(true)}
              disabled={isPending || selectedCount === 0}
            >
              거절
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                if (selectedCount === 0 || overCapacity) return;
                setConfirming(true);
              }}
              disabled={isPending || selectedCount === 0 || overCapacity}
            >
              {isPending ? "승인중..." : selectedCount > 0 ? `${selectedCount}명 승인` : "승인"}
            </Button>
          </>
        )}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">
              {selectedCount}명을 승인하시겠어요?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {selectedByRequest.size > 1 && (
                <span className="mb-1 block font-medium text-gray-700">
                  {selectedByRequest.size}개 지구 신청에 걸쳐 승인됩니다.
                </span>
              )}
              입금 확정 후에는 공급 지구 본인 사정으로 매칭 취소가 불가능합니다. 학생 자의 취소
              또는 송금 미완료 시에만 자리가 풀립니다. 신중히 진행해 주세요.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={isPending}
              >
                취소
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={isPending}>
                승인 확정
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
