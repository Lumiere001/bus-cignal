"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  KakaoSearchPicker,
  type PickedPlace,
} from "@/components/kakao/KakaoSearchPicker";
import type { MapPin } from "@/components/kakao/KakaoMultiMap";
import { DIRECTION_LABEL } from "@/lib/labels";
import { createTrip } from "../actions";

type Location = {
  id: string;
  direction: string;
  location_type: string;
  address: string;
  label: string | null;
  lat: number | null;
  lng: number | null;
};

// 한 지점(출발지/도착지) 선택 결과. id가 있으면 등록 장소, place가 있으면 새 장소.
type Selection =
  | { kind: "registered"; id: string }
  | { kind: "new"; place: PickedPlace }
  | null;

export function TripNewForm({ locations }: { locations: Location[] }) {
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [state, formAction, isPending] = useActionState(createTrip, undefined);

  // 방식 B: 지도/직접입력 모드 토글 (localhost 지도 미동작 시 select fallback).
  const [manual, setManual] = useState(false);

  const [origin, setOrigin] = useState<Selection>(null);
  const [dest, setDest] = useState<Selection>(null);

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
                onChange={() => {
                  setDirection(dir);
                  // 방향 바뀌면 선택 초기화 (다른 방향의 장소를 잘못 제출하지 않도록)
                  setOrigin(null);
                  setDest(null);
                }}
                className="accent-blue-600"
              />
              <span className="text-sm">{DIRECTION_LABEL[dir]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 입력 방식 토글 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">출발지 · 도착지</span>
        <button
          type="button"
          onClick={() => setManual((v) => !v)}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          {manual ? "지도에서 선택" : "목록에서 선택"}
        </button>
      </div>

      {manual ? (
        // ── Fallback: 기존 <select> 드롭다운 (지도 미동작 환경) ──
        <>
          <SelectField
            label="출발지"
            id="origin"
            name="origin_location_id"
            placeholder="출발지 선택"
            emptyMsg="등록된 출발지가 없습니다. 프로필에서 먼저 등록해주세요."
            options={origins}
            labelOf={locationLabel}
          />
          <SelectField
            label="도착지"
            id="dest"
            name="destination_location_id"
            placeholder="도착지 선택"
            emptyMsg="등록된 도착지가 없습니다. 프로필에서 먼저 등록해주세요."
            options={destinations}
            labelOf={locationLabel}
          />
        </>
      ) : (
        // ── 방식 B: 지도 + 검색으로 출발지/도착지 선택 ──
        <>
          <PointPicker
            title="출발지"
            options={origins}
            labelOf={locationLabel}
            value={origin}
            onChange={setOrigin}
          />
          <PointPicker
            title="도착지"
            options={destinations}
            labelOf={locationLabel}
            value={dest}
            onChange={setDest}
          />
          {/* 서버 액션 제출용 hidden — 등록 장소면 id, 새 장소면 JSON. */}
          {origin?.kind === "registered" && (
            <input type="hidden" name="origin_location_id" value={origin.id} />
          )}
          {origin?.kind === "new" && (
            <input
              type="hidden"
              name="origin_new"
              value={JSON.stringify(origin.place)}
            />
          )}
          {dest?.kind === "registered" && (
            <input type="hidden" name="destination_location_id" value={dest.id} />
          )}
          {dest?.kind === "new" && (
            <input type="hidden" name="dest_new" value={JSON.stringify(dest.place)} />
          )}
        </>
      )}

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

// ── Fallback <select> (기존 동작 유지) ──
function SelectField({
  label,
  id,
  name,
  placeholder,
  emptyMsg,
  options,
  labelOf,
}: {
  label: string;
  id: string;
  name: string;
  placeholder: string;
  emptyMsg: string;
  options: Location[];
  labelOf: (l: Location) => string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700" htmlFor={id}>
        {label}
      </label>
      {options.length === 0 ? (
        <p className="text-sm text-red-500">{emptyMsg}</p>
      ) : (
        <select
          id={id}
          name={name}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">{placeholder}</option>
          {options.map((l) => (
            <option key={l.id} value={l.id}>
              {labelOf(l)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── 방식 B 지점 선택기: 지도(등록 핀 + 검색) + 등록 장소 quick-select ──
function PointPicker({
  title,
  options,
  labelOf,
  value,
  onChange,
}: {
  title: string;
  options: Location[];
  labelOf: (l: Location) => string;
  value: Selection;
  onChange: (s: Selection) => void;
}) {
  // 좌표 있는 등록 장소만 지도 핀으로. address를 subtitle에 실어 핀 클릭→선택 가능.
  const pins: MapPin[] = useMemo(
    () =>
      options
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({
          id: l.id,
          lat: l.lat as number,
          lng: l.lng as number,
          title: labelOf(l),
          subtitle: l.address,
        })),
    [options, labelOf],
  );

  // 지도에서 장소를 고르면: 등록 핀과 좌표가 일치하면 등록 장소로, 아니면 새 장소로.
  function handlePick(p: PickedPlace) {
    const match = options.find(
      (l) =>
        l.lat != null &&
        l.lng != null &&
        Math.abs((l.lat as number) - p.lat) < 1e-6 &&
        Math.abs((l.lng as number) - p.lng) < 1e-6,
    );
    if (match) onChange({ kind: "registered", id: match.id });
    else onChange({ kind: "new", place: p });
  }

  // 현재 선택 요약 텍스트.
  let summary: string | null = null;
  if (value?.kind === "registered") {
    const l = options.find((o) => o.id === value.id);
    summary = l ? `등록 장소: ${labelOf(l)}` : "등록 장소";
  } else if (value?.kind === "new") {
    summary = `새 장소: ${value.place.placeName ?? value.place.address}`;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{title}</p>

      {/* 등록 장소 quick-select (지도 없이도 고를 수 있게) */}
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((l) => {
            const active = value?.kind === "registered" && value.id === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onChange({ kind: "registered", id: l.id })}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                }`}
              >
                {labelOf(l)}
              </button>
            );
          })}
        </div>
      )}

      <KakaoSearchPicker onPick={handlePick} pins={pins} initialCenter={pins[0]} />

      {summary ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="truncate text-sm text-gray-800">{summary}</p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
          >
            다시 선택
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          등록 장소를 고르거나 지도에서 검색해 선택하세요.
        </p>
      )}
    </div>
  );
}
