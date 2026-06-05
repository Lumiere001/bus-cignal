"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatKstDateTime } from "@/lib/datetime";
import { approveRequest, rejectRequest } from "./actions";

type QueuePassenger = {
  id: string;
  name: string;
  phoneTail: string;
  schoolOrRole: string | null;
  priority: number;
  note: string | null;
};

type QueueRequest = {
  id: string;
  requestedAt: string;
  regionName: string;
  passengers: QueuePassenger[];
};

export function MatchingQueue({
  tripId,
  availableSeats,
  queue,
}: {
  tripId: string;
  availableSeats: number;
  queue: QueueRequest[];
}) {
  if (queue.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
        대기 중인 신청이 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {queue.map((req) => (
        <RequestCard key={req.id} tripId={tripId} availableSeats={availableSeats} req={req} />
      ))}
    </ul>
  );
}

function RequestCard({
  tripId,
  availableSeats,
  req,
}: {
  tripId: string;
  availableSeats: number;
  req: QueueRequest;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(passengerId: string) {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(passengerId)) next.delete(passengerId);
      else next.add(passengerId);
      return next;
    });
  }

  const selectedCount = selected.size;
  const overCapacity = selectedCount > availableSeats;
  const allSelected =
    req.passengers.length > 0 && req.passengers.every((p) => selected.has(p.id));

  function toggleAll() {
    setError(null);
    setSelected(
      allSelected ? new Set() : new Set(req.passengers.map((p) => p.id)),
    );
  }

  // [N명 승인] → 안내 모달 (SPEC §S3.2: 입금 확정 후 공급측 취소 불가=K1 경고)
  function openConfirm() {
    setError(null);
    if (selectedCount === 0 || overCapacity) return;
    setConfirming(true);
  }

  // 모달의 [승인 확정] → 실제 매칭 생성
  function handleApprove() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const result = await approveRequest(tripId, req.id, [...selected]);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // 성공: 선택 상태를 비우고(유령 체크·"N명 승인" 잔존 방지) 서버 큐를 즉시 재조회.
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectRequest(tripId, req.id, reason);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRejecting(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">{req.regionName}</span>
        <span className="text-xs text-gray-400">{formatKstDateTime(req.requestedAt)} 신청</span>
      </div>

      {/* 선택 도구 — 승인은 선택한 학생만 매칭(부분 승인 가능). priority는 힌트(순서)일 뿐. */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          학생 {req.passengers.length}명 · {selectedCount}명 선택
        </span>
        <button
          type="button"
          onClick={toggleAll}
          disabled={isPending || rejecting}
          className="text-xs font-medium text-blue-600 hover:underline disabled:text-gray-300"
        >
          {allSelected ? "모두 해제" : "모두 선택"}
        </button>
      </div>

      <ul className="space-y-1.5">
        {req.passengers.map((p) => {
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
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500">
                  {p.priority}
                </span>
                <span className="font-medium text-gray-900">{p.name}</span>
                {p.schoolOrRole && (
                  <span className="text-gray-400">{p.schoolOrRole}</span>
                )}
                <span className="ml-auto text-xs text-gray-400">···{p.phoneTail}</span>
              </label>
              {p.note && (
                <p className="mt-1 pl-9 text-xs text-gray-400">메모: {p.note}</p>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {overCapacity && !error && (
        <p className="mt-3 text-xs text-red-500">
          잔여 {availableSeats}석보다 많이 선택했습니다.
        </p>
      )}

      {/* 거절 사유 입력 — 거절은 개별 학생이 아니라 "이 신청 전체"가 대상 */}
      {rejecting && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠️ 이 신청 <b>전체({req.passengers.length}명)</b>가 거절됩니다. 체크박스 선택과
            무관하게 신청 한 건이 통째로 거절되고, 사유가 신청 지구에 전달됩니다. (특정
            학생만 빼려면 거절 대신 <b>원하는 학생만 승인</b>하세요.)
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="거절 사유 (10자 이상, 신청 지구에 전달됩니다)"
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
            <Button
              size="sm"
              onClick={handleReject}
              disabled={isPending || reason.trim().length < 10}
            >
              {isPending ? "처리중..." : "거절 확정"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejecting(true)}
              disabled={isPending}
            >
              거절
            </Button>
            <Button
              size="sm"
              onClick={openConfirm}
              disabled={isPending || selectedCount === 0 || overCapacity}
            >
              {isPending
                ? "승인중..."
                : selectedCount > 0
                  ? `${selectedCount}명 승인`
                  : "승인"}
            </Button>
          </>
        )}
      </div>

      {/* 승인 안내 모달 — SPEC §S3.2·§5.5 (K1: 입금 확정 후 공급측 취소 불가) */}
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
              입금 확정 후에는 공급 지구 본인 사정으로 매칭 취소가 불가능합니다.
              학생 자의 취소 또는 송금 미완료 시에만 자리가 풀립니다. 신중히 진행해
              주세요.
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
    </li>
  );
}
