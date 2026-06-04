"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { DIRECTION_LABEL } from "@/lib/labels";
import { createTrip } from "../actions";

type Location = {
  id: string;
  direction: string;
  location_type: string;
  address: string;
  label: string | null;
};

export function TripNewForm({ locations }: { locations: Location[] }) {
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [state, formAction, isPending] = useActionState(createTrip, undefined);

  const origins = locations.filter(
    (l) => l.direction === direction && l.location_type === "origin",
  );
  const destinations = locations.filter(
    (l) => l.direction === direction && l.location_type === "destination",
  );

  const locationLabel = (l: Location) => l.label ?? l.address;

  // 최소 출발 시각: 오늘 (KST)
  const minDatetime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  )
    .toISOString()
    .slice(0, 16);

  return (
    <form action={formAction} className="space-y-5">
      {/* 방향 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">방향</legend>
        <div className="flex gap-4">
          {(["down", "up"] as const).map((dir) => (
            <label key={dir} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="direction"
                value={dir}
                checked={direction === dir}
                onChange={() => setDirection(dir)}
                className="accent-blue-600"
              />
              <span className="text-sm">{DIRECTION_LABEL[dir]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 출발지 */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700" htmlFor="origin">
          출발지
        </label>
        {origins.length === 0 ? (
          <p className="text-sm text-red-500">
            등록된 출발지가 없습니다. 프로필에서 먼저 등록해주세요.
          </p>
        ) : (
          <select
            id="origin"
            name="origin_location_id"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">출발지 선택</option>
            {origins.map((l) => (
              <option key={l.id} value={l.id}>
                {locationLabel(l)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 도착지 */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700" htmlFor="dest">
          도착지
        </label>
        {destinations.length === 0 ? (
          <p className="text-sm text-red-500">
            등록된 도착지가 없습니다. 프로필에서 먼저 등록해주세요.
          </p>
        ) : (
          <select
            id="dest"
            name="destination_location_id"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">도착지 선택</option>
            {destinations.map((l) => (
              <option key={l.id} value={l.id}>
                {locationLabel(l)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 출발 시각 */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700" htmlFor="departure">
          출발 시각
        </label>
        <input
          id="departure"
          type="datetime-local"
          name="departure_at"
          required
          min={minDatetime}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* 정원 / 요금 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="capacity">
            정원 (명)
          </label>
          <input
            id="capacity"
            type="number"
            name="capacity"
            required
            min={1}
            max={200}
            placeholder="예) 44"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="price">
            요금 (원/인)
          </label>
          <input
            id="price"
            type="number"
            name="price_per_seat"
            required
            min={0}
            placeholder="예) 35000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 총무(학생 담당) 연락처 — 학생이 차편 카드에서 연락할 담당자 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="treasurer_name"
          >
            총무 이름
          </label>
          <input
            id="treasurer_name"
            type="text"
            name="treasurer_name"
            required
            maxLength={50}
            placeholder="예) 홍길동"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="treasurer_phone"
          >
            총무 연락처
          </label>
          <input
            id="treasurer_phone"
            type="tel"
            name="treasurer_phone"
            required
            inputMode="numeric"
            placeholder="예) 010-1234-5678"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <p className="col-span-2 text-xs text-gray-400">
          학생이 차편 안내에서 연락할 담당자입니다. 담당 간사 연락처와 별개입니다.
        </p>
      </div>

      {/* 메모 */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700" htmlFor="note">
          메모{" "}
          <span className="font-normal text-gray-400">(선택, 최대 500자)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          placeholder="탑승 안내, 집결 위치 등"
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* 에러 */}
      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      {/* 제출 */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "저장중..." : "임시저장"}
        </Button>
      </div>
    </form>
  );
}
