"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmPayment, releaseSeat, cancelMatch } from "./actions";

type Props = {
  matchId: string;
  status: string;
  reservationCode: string | null;
};

export function MatchActions({ matchId, status, reservationCode }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error: string } | { ok: true }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) setError(result.error);
    });
  }

  // 입금 확인 확정 → 실제 서버액션 (모달의 [확인]에서 호출). 로직은 기존 confirmPayment 그대로.
  function handleConfirmPayment() {
    setConfirmingPayment(false);
    run(() => confirmPayment(matchId));
  }

  // 매칭 해제 확정 → releaseSeat (모달의 [매칭 해제]에서 호출). 실수 클릭 방지용 확인 게이트(#7).
  function handleRelease() {
    setConfirmingRelease(false);
    run(() => releaseSeat(matchId));
  }

  // 입금 완료 = 예약번호 노출, 추가 액션 없음 (K1: 공급측 취소 불가)
  if (status === "paid") {
    return (
      <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
        예약번호 {reservationCode ?? "—"}
      </span>
    );
  }

  // 종료 상태는 액션 없음
  if (status === "expired" || status === "cancelled") return null;

  const canConfirm = status === "awaiting_payment" || status === "payment_reported";
  const canCancel = status === "payment_reported"; // Phase 2

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {canceling ? (
        <div className="flex flex-col items-end gap-1">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="취소 사유 (5자+)"
            maxLength={500}
            disabled={isPending}
            className="w-44 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          />
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCanceling(false);
                setReason("");
                setError(null);
              }}
              disabled={isPending}
            >
              닫기
            </Button>
            <Button
              size="sm"
              onClick={() => run(() => cancelMatch(matchId, reason))}
              disabled={isPending || reason.trim().length < 5}
            >
              취소 확정
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1">
          {canConfirm && (
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                setConfirmingPayment(true);
              }}
              disabled={isPending}
            >
              {isPending ? "처리중..." : "입금 확인"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setConfirmingRelease(true);
            }}
            disabled={isPending}
          >
            매칭 해제
          </Button>
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanceling(true)}
              disabled={isPending}
            >
              매칭 취소
            </Button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 입금 확인 게이트 — 확정 후 취소 불가(K1)이므로 한 번 더 확인 */}
      {confirmingPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmingPayment(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">입금 확인</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              입금 확인 시 취소할 수 없습니다. 계속할까요?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmingPayment(false)}
                disabled={isPending}
              >
                취소
              </Button>
              <Button size="sm" onClick={handleConfirmPayment} disabled={isPending}>
                입금 확인
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 매칭 해제 게이트 — 실수 클릭 방지 + 무엇을 하는지 설명(#6·#7) */}
      {confirmingRelease && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmingRelease(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">매칭 해제</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              이 학생과의 매칭을 해제하고 좌석을 다시 비웁니다. 신청 지구는 다시 대기
              상태로 돌아가요(재매칭 가능). 입금 전 잘못 승인했을 때 사용하세요.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmingRelease(false)}
                disabled={isPending}
              >
                닫기
              </Button>
              <Button size="sm" onClick={handleRelease} disabled={isPending}>
                매칭 해제
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
