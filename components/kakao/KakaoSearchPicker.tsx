"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  loadKakaoMapSdk,
  type KakaoMap,
  type KakaoMarker,
  type KakaoPlaces,
  type KakaoPlacesResult,
} from "@/lib/kakao/load-sdk";
import type { MapPin } from "@/components/kakao/KakaoMultiMap";

// 방식 B — 카카오 지도 + 키워드 검색으로 장소를 골라 주소·좌표를 얻는 재사용 picker.
//
// ⚠️ 카카오 지도는 등록된 배포 도메인에서만 렌더된다. localhost(빌린 키)에서는
//    SDK 로드/렌더가 실패한다. 이 컴포넌트는 그 경우 status="error"로 안내만 띄우고
//    절대 crash하지 않는다 — 부모 폼은 자체 fallback 입력으로 계속 동작해야 한다.

export type PickedPlace = {
  address: string;
  lat: number;
  lng: number;
  placeName?: string;
};

type Props = {
  onPick: (p: PickedPlace) => void;
  initialCenter?: { lat: number; lng: number };
  pins?: MapPin[];
  heightClass?: string;
};

type Status = "loading" | "ready" | "error";

// 기본 중심: 강원 평창(대관령 일대) — region 핀이 없을 때의 fallback center.
const DEFAULT_CENTER = { lat: 37.6803, lng: 128.7339 };

// 검색 결과 한 건 → PickedPlace. 도로명 주소 우선, 없으면 지번 주소.
function resultToPlace(r: KakaoPlacesResult): PickedPlace | null {
  const lat = Number(r.y);
  const lng = Number(r.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const address = (r.road_address_name || r.address_name || "").trim();
  if (!address) return null;
  return { address, lat, lng, placeName: r.place_name || undefined };
}

export function KakaoSearchPicker({
  onPick,
  initialCenter,
  pins = [],
  heightClass = "h-72",
}: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  // 지도/검색/마커 핸들 (재렌더에도 유지). 등록 핀 마커와 "선택 핀" 마커는 분리 관리.
  const mapRef = useRef<KakaoMap | null>(null);
  const placesRef = useRef<KakaoPlaces | null>(null);
  const pinMarkersRef = useRef<KakaoMarker[]>([]);
  const pickMarkerRef = useRef<KakaoMarker | null>(null);

  // 검색 상태 (UI)
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<KakaoPlacesResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  // onPick을 ref로 보관 → 콜백 변경이 지도 effect 재실행을 유발하지 않도록.
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const listboxId = useId();

  const center = initialCenter ?? pins[0] ?? DEFAULT_CENTER;
  // 등록 핀 내용이 같으면 effect 재실행 안 하도록 직렬화 (KakaoMultiMap와 동일 패턴).
  const pinsKey = pins
    .map((p) => `${p.id}:${p.lat}:${p.lng}:${p.title}`)
    .join("|");

  // 지도 + 등록 핀 초기화 (1회 + pins/center 변경 시).
  useEffect(() => {
    let cancelled = false;

    // SDK가 8초 내 초기화 안 되면 error (도메인 미등록 등 silent hang 대응 — load-sdk와 동일 시간).
    const timeoutId = setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, 8000);

    loadKakaoMapSdk()
      .then(() => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const container = containerRef.current;
        const maps = window.kakao?.maps;
        // services(Places) 미로드 시 검색 불가 → 사용 불가로 간주(부모 fallback 사용).
        if (!container || !maps || !maps.services?.Places) {
          setStatus("error");
          return;
        }

        const map = new maps.Map(container, {
          center: new maps.LatLng(center.lat, center.lng),
          level: 6,
        });
        mapRef.current = map;
        placesRef.current = new maps.services.Places();

        // 등록된 장소 핀 표시 (공간 맥락). 클릭하면 해당 장소를 그대로 선택.
        const pinMarkers: KakaoMarker[] = [];
        for (const pin of pins) {
          const position = new maps.LatLng(pin.lat, pin.lng);
          const marker = new maps.Marker({ position, title: pin.title });
          marker.setMap(map);
          maps.event.addListener(marker, "click", () => {
            onPickRef.current({
              address: pin.subtitle ?? pin.title,
              lat: pin.lat,
              lng: pin.lng,
              placeName: pin.title,
            });
            placePickMarker(pin.lat, pin.lng);
          });
          pinMarkers.push(marker);
        }
        pinMarkersRef.current = pinMarkers;

        // 핀이 여러 개면 모두 보이도록 bounds fit.
        if (pins.length > 1) {
          const bounds = new maps.LatLngBounds();
          for (const pin of pins) bounds.extend(new maps.LatLng(pin.lat, pin.lng));
          map.setBounds(bounds);
        }

        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      for (const m of pinMarkersRef.current) m.setMap(null);
      pinMarkersRef.current = [];
      if (pickMarkerRef.current) {
        pickMarkerRef.current.setMap(null);
        pickMarkerRef.current = null;
      }
      mapRef.current = null;
      placesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- center/pins는 직렬화 키로 비교
  }, [pinsKey, center.lat, center.lng]);

  // 선택 핀(검색/클릭으로 고른 위치) 표시 + 지도 이동.
  function placePickMarker(lat: number, lng: number): void {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) return;
    const position = new maps.LatLng(lat, lng);
    if (pickMarkerRef.current) {
      pickMarkerRef.current.setMap(null);
    }
    const marker = new maps.Marker({ position, title: "선택한 위치" });
    marker.setMap(map);
    pickMarkerRef.current = marker;
    map.setCenter(position);
    map.setLevel(4);
    // 검색 결과 목록이 접히며 지도가 위로 밀리는 등 컨테이너가 리플로우될 수 있다.
    // 그러면 카카오 마커 레이어 크기 계산이 어긋나 '선택한 위치' 핀이 0×0로 숨는다(내 정보 화면 버그).
    // 다음 프레임(레이아웃 확정 후)에 relayout + 재센터링으로 마커 레이어를 다시 그린다.
    requestAnimationFrame(() => {
      const m = mapRef.current;
      if (!m) return;
      m.relayout();
      m.setCenter(position);
    });
  }

  function runSearch(): void {
    const places = placesRef.current;
    const q = keyword.trim();
    setSearchMsg(null);
    if (!q) {
      setSearchMsg("검색어를 입력해주세요.");
      return;
    }
    if (!places) {
      setSearchMsg("지도 검색을 사용할 수 없습니다.");
      return;
    }
    setSearching(true);
    setSearched(true);
    places.keywordSearch(q, (data, st) => {
      setSearching(false);
      if (st === "OK" && data.length > 0) {
        setResults(data);
        setSearchMsg(null);
      } else if (st === "ZERO_RESULT") {
        setResults([]);
        setSearchMsg("검색 결과가 없습니다. 다른 검색어를 시도해보세요.");
      } else {
        setResults([]);
        setSearchMsg("검색 중 오류가 발생했습니다.");
      }
    });
  }

  function handleSelectResult(r: KakaoPlacesResult): void {
    const place = resultToPlace(r);
    if (!place) {
      setSearchMsg("이 장소의 좌표를 가져오지 못했습니다.");
      return;
    }
    onPickRef.current(place);
    placePickMarker(place.lat, place.lng);
    // 선택 후 결과 목록은 접어 정리감을 줌.
    setResults([]);
    setSearched(false);
  }

  return (
    <div className="space-y-2">
      {/* 검색 박스 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          disabled={status !== "ready"}
          placeholder="장소·주소 검색 (예: 평창 대관령)"
          aria-label="장소 검색"
          aria-controls={listboxId}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={status !== "ready" || searching}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          {searching ? "검색중..." : "검색"}
        </button>
      </div>

      {/* 검색 결과 목록 */}
      {status === "ready" && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="검색 결과"
          className="max-h-48 divide-y overflow-y-auto rounded-lg border bg-white"
        >
          {results.map((r) => (
            <li key={r.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => handleSelectResult(r)}
                className="block w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              >
                <span className="block text-sm font-medium text-gray-900">
                  {r.place_name}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {r.road_address_name || r.address_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {status === "ready" && searchMsg && (
        <p className="text-xs text-gray-500">{searchMsg}</p>
      )}
      {status === "ready" && searched && !searching && results.length === 0 && !searchMsg && (
        <p className="text-xs text-gray-500">검색 결과가 없습니다.</p>
      )}

      {/* 지도 */}
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-muted ${heightClass}`}
        aria-label="지도"
      >
        <div ref={containerRef} className="h-full w-full" />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground text-sm">지도 불러오는 중…</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
            <span className="text-muted-foreground text-sm">
              지도는 배포 환경에서만 동작합니다.
            </span>
            <span className="text-muted-foreground text-xs">
              아래에서 직접 입력해 주세요.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
