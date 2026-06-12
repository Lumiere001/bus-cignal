"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatKstDateTime, formatKstShort } from "@/lib/datetime";
import { approveRequest, rejectRequest, declinePassengers } from "./actions";

export type QueuePassenger = {
  id: string;
  name: string;
  phone: string;
  schoolOrRole: string | null;
  priority: number;
  note: string | null;
  /** 개인 신청 시각(KST ISO) — 사전 수합분은 개별, 일반 신청은 신청 시각 폴백. */
  appliedAt: string;
};

export type QueueRequest = {
  id: string;
  requestedAt: string;
  regionName: string;
  operatorName: string | null;
  operatorPhone: string | null;
  /** 'student' = 학생 직접 신청(담당 간사 없음), 'operator' = 간사 신청. */
  requesterKind: "student" | "operator";
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

  // 지구별 묶음 — 같은 지구의 신청 여러 건(직접 신청 + 대기큐 이동분 등)을 한 영역으로.
  // 승인/거절은 신청 단위(RPC)라 카드 단위는 유지하고, 지구는 영역 헤더로 묶는다.
  const regions = new Map<string, QueueRequest[]>();
  for (const req of queue) {
    const list = regions.get(req.regionName);
    if (list) list.push(req);
    else regions.set(req.regionName, [req]);
  }

  return (
    <ul className="space-y-4">
      {[...regions.entries()].map(([regionName, reqs]) => (
        <li key={regionName}>
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <span className="text-sm font-semibold text-gray-900">{regionName}</span>
            <span className="text-xs text-gray-400">
              신청 {reqs.length}건 · 학생{" "}
              {reqs.reduce((n, r) => n + r.passengers.length, 0)}명
            </span>
          </div>
          <ul className="space-y-2">
            {reqs.map((req) => (
              <RequestCard
                key={req.id}
                tripId={tripId}
                availableSeats={availableSeats}
                req={req}
              />
            ))}
          </ul>
        </li>
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

  // [거절] 확정 — 체크한 학생이 있으면 '선택 학생만' 거절, 없으면 신청 전체 거절.
  function confirmRejectOrDecline() {
    if (selectedCount > 0) handleDecline();
    else handleReject();
  }

  // 선택 학생만 거절 (나머지는 대기 유지). 성공 시 선택 비우고 큐 재조회.
  function handleDecline() {
    setError(null);
    startTransition(async () => {
      const result = await declinePassengers(tripId, req.id, [...selected], reason);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRejecting(false);
      setReason("");
      setSelected(new Set());
      router.refresh();
    });
  }

  // 신청 전체 거절 (학생 미선택 시). 사유 필수(10자+).
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
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* 지구명은 영역 헤더(지구별 묶음)로 올라감 — 카드에는 신청 주체만 표시 */}
          {req.requesterKind === "student" ? (
            // 학생 직접 신청 — 담당 간사 없음. 본인 정보는 아래 명단(이름·전화)에 그대로.
            <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
              학생 직접 신청
            </span>
          ) : (
            // 신청 지구 담당 간사 연락처 — 운영 연락용 (팀장 승인)
            <span className="text-xs text-gray-500">
              담당 간사 {req.operatorName ?? "미지정"}
              {req.operatorPhone && (
                <a
                  href={`tel:${req.operatorPhone}`}
                  className="ml-1 text-blue-600 hover:underline"
                >
                  {req.operatorPhone}
                </a>
              )}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-400">
          {formatKstDateTime(req.requestedAt)} 신청
        </span>
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
                <span className="text-[11px] tabular-nums text-gray-400">
                  {formatKstShort(p.appliedAt)}
                </span>
                {/* 전화번호 풀 노출 — 간사 운영 연락용 (팀장 승인, 마스킹 금지) */}
                <a
                  href={`tel:${p.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto text-xs text-blue-600 hover:underline"
                >
                  {p.phone}
                </a>
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

      {/* 거절 패널 — 체크한 학생이 있으면 '선택 학생만' 거절, 없으면 신청 전체 거절(경고). */}
      {rejecting && (
        <div className="mt-3 space-y-2">
          {selectedCount > 0 ? (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              체크한 <b>{selectedCount}명</b>만 이 신청에서 거절(제거)합니다. 남은{" "}
              <b>{req.passengers.length - selectedCount}명</b>은 대기 상태로 유지돼요. 사유는
              선택이며 신청 지구에 전달됩니다.
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠️ 학생을 한 명도 선택하지 않아 이 신청 <b>전체({req.passengers.length}명)</b>가
              취소됩니다. 특정 학생만 빼려면 닫고 그 학생을 체크한 뒤 다시 거절하세요.
            </p>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={
              selectedCount > 0
                ? "거절 사유 (선택, 신청 지구에 전달됩니다)"
                : "거절 사유 (10자 이상, 신청 지구에 전달됩니다)"
            }
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
              onClick={confirmRejectOrDecline}
              disabled={
                isPending || (selectedCount === 0 && reason.trim().length < 10)
              }
            >
              {isPending
                ? "처리중..."
                : selectedCount > 0
                  ? `${selectedCount}명 거절`
                  : "신청 전체 거절"}
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
