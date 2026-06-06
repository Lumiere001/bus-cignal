"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  KakaoSearchPicker,
  type PickedPlace,
} from "@/components/kakao/KakaoSearchPicker";
import type { MapPin } from "@/components/kakao/KakaoMultiMap";
import { DIRECTION_SHORT } from "@/lib/labels";
import { addLocation, deleteLocation } from "./actions";

export type RegionLocation = {
  id: string;
  direction: "up" | "down";
  location_type: "origin" | "destination";
  address: string;
  label: string | null;
  lat: number | null;
  lng: number | null;
};

const TYPE_LABEL: Record<string, string> = {
  origin: "출발지",
  destination: "도착지",
};

export function LocationManager({ locations }: { locations: RegionLocation[] }) {
  const [state, formAction, isPending] = useActionState(addLocation, undefined);

  // 지도에서 고른 장소 (방식 B). null이면 미선택.
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  // 직접 입력 모드 — 지도 미동작(localhost)·수동 보정용 fallback.
  const [manual, setManual] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  // 좌표가 있는 기존 장소만 지도 핀으로 표시 (공간 맥락).
  const pins: MapPin[] = useMemo(
    () =>
      locations
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({
          id: l.id,
          lat: l.lat as number,
          lng: l.lng as number,
          title: l.label ?? l.address,
          subtitle: l.address,
        })),
    [locations],
  );

  // 제출 후 상태 초기화는 굳이 하지 않음(revalidate로 목록 갱신). 다시 선택은 사용자 클릭.
  function handlePick(p: PickedPlace) {
    setPicked(p);
    setManual(false);
  }

  // 직접 입력 모드일 땐 manualAddress, 지도 모드일 땐 picked.address를 제출.
  const submitAddress = manual ? manualAddress.trim() : (picked?.address ?? "");
  const canSubmit = submitAddress.length >= 2;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">출발지 · 도착지 관리</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          차량 등록 시 선택하는 집합지(출발지)·도착지 목록입니다. 방향별로 등록해 주세요.
        </p>
      </div>

      {/* 등록된 장소 목록 */}
      {locations.length === 0 ? (
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-gray-400">
          등록된 장소가 없습니다. 아래에서 추가해 주세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {locations.map((l) => (
            <LocationRow key={l.id} loc={l} />
          ))}
        </ul>
      )}

      {/* 추가 폼 */}
      <form action={formAction} className="space-y-3 rounded-xl border bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700">새 장소 추가</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600" htmlFor="direction">
              방향
            </label>
            <select
              id="direction"
              name="direction"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="down">하행 (평창 → 지역)</option>
              <option value="up">상행 (지역 → 평창)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600" htmlFor="location_type">
              종류
            </label>
            <select
              id="location_type"
              name="location_type"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="origin">출발지 (집합지)</option>
              <option value="destination">도착지</option>
            </select>
          </div>
        </div>

        {/* 주소 — 방식 B: 지도에서 검색·선택. localhost 등 지도 미동작 시 직접 입력 fallback. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">
              주소 {manual ? "(직접 입력)" : "(지도에서 선택)"}
            </label>
            <button
              type="button"
              onClick={() => setManual((v) => !v)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {manual ? "지도에서 선택" : "직접 입력"}
            </button>
          </div>

          {!manual && (
            <>
              <KakaoSearchPicker
                onPick={handlePick}
                pins={pins}
                initialCenter={pins[0]}
              />
              {picked ? (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <div className="min-w-0">
                    {picked.placeName && (
                      <p className="text-sm font-medium text-gray-900">
                        {picked.placeName}
                      </p>
                    )}
                    <p className="truncate text-sm text-gray-700">{picked.address}</p>
                    <p className="text-xs text-gray-500">
                      좌표: {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                  >
                    다시 선택
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  지도에서 장소를 검색해 선택하면 주소·좌표가 자동 입력됩니다.
                </p>
              )}
            </>
          )}

          {manual && (
            <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              maxLength={200}
              placeholder="예) 강원 평창군 봉평면 무이리"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          )}

          {/* 서버 액션 제출용 필드 — 모드와 무관하게 address를 채워 보냄. 좌표는 지도 선택 시에만. */}
          <input type="hidden" name="address" value={submitAddress} />
          {!manual && picked && (
            <>
              <input type="hidden" name="lat" value={picked.lat} />
              <input type="hidden" name="lng" value={picked.lng} />
            </>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600" htmlFor="label">
            이름표 <span className="font-normal text-gray-400">(선택, 학생에게 표시)</span>
          </label>
          <input
            id="label"
            name="label"
            type="text"
            maxLength={50}
            placeholder="예) 평창 대관령"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending || !canSubmit}>
            {isPending ? "추가중..." : "추가"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function LocationRow({ loc }: { loc: RegionLocation }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteLocation(loc.id);
      if (result?.error) setError(result.error);
      // 성공 시 revalidatePath로 목록 재렌더 → 이 행 사라짐
    });
  }

  return (
    <li className="rounded-xl border bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              {DIRECTION_SHORT[loc.direction]}
            </span>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {TYPE_LABEL[loc.location_type]}
            </span>
            {loc.label && <span className="text-sm font-medium text-gray-900">{loc.label}</span>}
          </div>
          <p className="truncate text-sm text-gray-500">{loc.address}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0"
        >
          {isPending ? "삭제중..." : "삭제"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </li>
  );
}
