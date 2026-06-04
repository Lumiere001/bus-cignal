"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createRequest, type PassengerInput } from "../actions";

type TripOption = {
  id: string;
  label: string;
  regionName: string;
  departure: string;
  price: number;
  availableSeats: number;
};

type PassengerRow = PassengerInput & { key: number };

function emptyRow(key: number): PassengerRow {
  return { key, name: "", phone: "", schoolOrRole: "", note: "" };
}

export function NewRequestForm({ trips }: { trips: TripOption[] }) {
  const [tripId, setTripId] = useState<string>("");
  const [rows, setRows] = useState<PassengerRow[]>([emptyRow(0)]);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextKey = () => rows.reduce((max, r) => Math.max(max, r.key), 0) + 1;

  function updateRow(key: number, field: keyof PassengerInput, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow(nextKey())]);
  }
  function removeRow(key: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }
  // 우선순위 = 행 순서 (1번째 = priority 1). 위/아래 이동으로 순서 조정.
  function move(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const selectedTrip = trips.find((t) => t.id === tripId);

  function handleSubmit() {
    setError(null);
    if (!tripId) {
      setError("신청할 차량을 선택해주세요.");
      return;
    }
    const payload: PassengerInput[] = rows.map((r) => ({
      name: r.name,
      phone: r.phone,
      schoolOrRole: r.schoolOrRole,
      note: r.note,
    }));
    startTransition(async () => {
      const result = await createRequest(tripId, payload, consent);
      if (result?.error) setError(result.error);
      // 성공 시 서버 액션이 /operator/requests로 redirect
    });
  }

  return (
    <div className="space-y-6">
      {/* 차량 선택 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">신청할 차량 (타지구)</label>
        <div className="space-y-2">
          {trips.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
                tripId === t.id ? "border-blue-400 bg-blue-50" : "border-gray-200"
              }`}
            >
              <input
                type="radio"
                name="trip"
                value={t.id}
                checked={tripId === t.id}
                onChange={() => setTripId(t.id)}
                disabled={isPending}
                className="mt-1 accent-blue-600"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">{t.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {t.regionName} · {t.departure} 출발 · {t.price.toLocaleString()}원/인 · 잔여{" "}
                  {t.availableSeats}석
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 학생 명단 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            학생 명단{" "}
            <span className="font-normal text-gray-400">
              (위에서부터 우선순위 — 공급 간사 참고용 힌트)
            </span>
          </label>
          <span className="text-xs text-gray-400">{rows.length}명</span>
        </div>

        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.key} className="rounded-lg border border-gray-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                  {i + 1}
                </span>
                <span className="text-xs text-gray-400">우선순위 {i + 1}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={isPending || i === 0}
                    className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={isPending || i === rows.length - 1}
                    className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    aria-label="아래로"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    disabled={isPending || rows.length === 1}
                    className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50 disabled:opacity-30"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={r.name}
                  onChange={(e) => updateRow(r.key, "name", e.target.value)}
                  placeholder="이름 *"
                  maxLength={50}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  value={r.phone}
                  onChange={(e) => updateRow(r.key, "phone", e.target.value)}
                  placeholder="전화번호 *"
                  inputMode="tel"
                  maxLength={13}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  value={r.schoolOrRole}
                  onChange={(e) => updateRow(r.key, "schoolOrRole", e.target.value)}
                  placeholder="학교/역할 (선택)"
                  maxLength={100}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  value={r.note}
                  onChange={(e) => updateRow(r.key, "note", e.target.value)}
                  placeholder="메모 (선택)"
                  maxLength={200}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </li>
          ))}
        </ul>

        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={isPending}>
          + 학생 추가
        </Button>
      </div>

      {/* 개인정보 동의 */}
      <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={isPending}
          className="mt-0.5 accent-blue-600"
        />
        <span className="text-gray-600">
          학생 개인정보(이름·전화)를 차량 매칭·운행 안내 목적으로 수집·이용하는 데 동의합니다.
          (수련회 종료 후 90일 보관 뒤 익명화)
        </span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        {selectedTrip && rows.length > selectedTrip.availableSeats && (
          <span className="text-xs text-amber-600">
            잔여 {selectedTrip.availableSeats}석보다 많이 신청 — 대기 큐에 남을 수 있어요
          </span>
        )}
        <Button onClick={handleSubmit} disabled={isPending || !consent}>
          {isPending ? "신청중..." : "신청하기"}
        </Button>
      </div>
    </div>
  );
}
