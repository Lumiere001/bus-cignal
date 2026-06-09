"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DIRECTION_SHORT } from "@/lib/labels";
import { formatKstDateTime, formatWon } from "@/lib/datetime";
import { createStudentRequest } from "../actions";

// page.tsx 에서 내려주는 신청 가능 차량 1건 (published + 잔여>0).
export type ApplyTrip = {
  id: string;
  direction: "up" | "down";
  departureAt: string; // ISO (UTC)
  pricePerSeat: number;
  regionName: string;
  originLabel: string;
  destinationLabel: string;
  availableSeats: number;
};

type DirFilter = "all" | "up" | "down";

export function StudentApply({
  trips,
  studentName,
  studentPhone,
}: {
  trips: ApplyTrip[];
  studentName: string;
  studentPhone: string;
}) {
  const [dir, setDir] = useState<DirFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => (dir === "all" ? trips : trips.filter((t) => t.direction === dir)),
    [trips, dir],
  );
  const selected = trips.find((t) => t.id === selectedId) ?? null;

  function openConfirm(id: string) {
    setError(null);
    setConsent(false);
    setSelectedId(id);
  }

  function submit() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await createStudentRequest(selected.id, consent);
      // 성공 시 서버 액션이 /s 로 redirect → 아래는 실패(에러)만 도달.
      if (result?.error) setError(result.error);
    });
  }

  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
        지금 신청할 수 있는 차량이 없어요.
        <br />
        자리가 새로 열리면 이곳에 표시됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 방향 필터 */}
      <div className="flex gap-2">
        {(
          [
            ["all", "전체"],
            ["up", "상행"],
            ["down", "하행"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDir(value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              dir === value
                ? "bg-blue-600 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-gray-400">
          해당 방향의 신청 가능한 차량이 없어요.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openConfirm(t.id)}
                className="flex w-full items-start justify-between gap-2 rounded-xl border border-gray-200 px-3 py-3 text-left hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900">
                    [{DIRECTION_SHORT[t.direction]}] {t.originLabel} → {t.destinationLabel}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {t.regionName} · {formatKstDateTime(t.departureAt)} 출발 ·{" "}
                    {formatWon(t.pricePerSeat)}/인
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs whitespace-nowrap text-green-700">
                  잔여 {t.availableSeats}석
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 신청 확인 모달 — 본인 정보 미리채움 + 동의 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !isPending && setSelectedId(null)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-gray-900">이 차량에 신청할까요?</h2>

            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
              <div className="text-sm font-medium text-gray-900">
                [{DIRECTION_SHORT[selected.direction]}] {selected.originLabel} →{" "}
                {selected.destinationLabel}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {selected.regionName} · {formatKstDateTime(selected.departureAt)} 출발 ·{" "}
                {formatWon(selected.pricePerSeat)}/인 · 잔여 {selected.availableSeats}석
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
              <p className="text-xs text-gray-400">신청자 (CCC 계정 정보)</p>
              <p className="mt-0.5 font-medium text-gray-900">
                {studentName}{" "}
                <span className="font-normal text-gray-500">· {studentPhone}</span>
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={isPending}
                className="mt-0.5 accent-blue-600"
              />
              <span className="text-gray-600">
                내 개인정보(이름·전화)를 차량 매칭·운행 안내 목적으로 수집·이용하는 데
                동의합니다. (수련회 종료 후 90일 보관 뒤 익명화)
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedId(null)}
                disabled={isPending}
              >
                취소
              </Button>
              <Button size="sm" onClick={submit} disabled={isPending || !consent}>
                {isPending ? "신청중..." : "신청하기"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
