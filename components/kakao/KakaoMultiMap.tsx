"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadKakaoMapSdk,
  type KakaoInfoWindow,
  type KakaoMap,
  type KakaoMarker,
} from "@/lib/kakao/load-sdk";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
};

type Props = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  heightClass?: string;
};

type Status = "loading" | "ready" | "error";

type MarkerEntry = {
  id: string;
  marker: KakaoMarker;
  infoWindow: KakaoInfoWindow;
};

// InfoWindow content를 안전하게 escape (title·subtitle은 사용자/외부 데이터일 수 있음)
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInfoWindowContent(pin: MapPin): string {
  const title = `<div style="font-weight:600;font-size:13px;color:#111;">${escapeHtml(pin.title)}</div>`;
  const subtitle = pin.subtitle
    ? `<div style="margin-top:2px;font-size:12px;color:#666;">${escapeHtml(pin.subtitle)}</div>`
    : "";
  return `<div style="padding:6px 10px;min-width:80px;">${title}${subtitle}</div>`;
}

export function KakaoMultiMap({
  pins,
  selectedId,
  onSelect,
  heightClass = "h-64",
}: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  // 지도/마커 핸들 보관 (selectedId 변경 시 재생성 없이 InfoWindow만 제어)
  const mapRef = useRef<KakaoMap | null>(null);
  const entriesRef = useRef<MarkerEntry[]>([]);
  const openInfoWindowRef = useRef<KakaoInfoWindow | null>(null);

  // 콜백을 ref로 보관 → onSelect 변경이 지도 재생성을 유발하지 않도록
  const onSelectRef = useRef<Props["onSelect"]>(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // 빈 배열일 때 의존성 키 안정화 위해 직렬화 (pins 참조가 매 렌더 바뀌어도 내용 같으면 재생성 안 함)
  const pinsKey = pins
    .map((p) => `${p.id}:${p.lat}:${p.lng}:${p.title}:${p.subtitle ?? ""}`)
    .join("|");

  useEffect(() => {
    if (pins.length === 0) {
      // 빈 배열이면 지도를 만들지 않음 — render의 pins.length===0 분기가 안내 오버레이 표시.
      // (effect에서 동기 setState 금지 규칙 때문에 status는 건드리지 않음)
      mapRef.current = null;
      entriesRef.current = [];
      openInfoWindowRef.current = null;
      return;
    }

    let cancelled = false;

    // SDK가 8초 내에 초기화되지 않으면 error로 전환 (도메인 미등록 등 silent hang 대응)
    const timeoutId = setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, 8000);

    loadKakaoMapSdk()
      .then(() => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        const container = containerRef.current;
        if (!container) return;

        const maps = window.kakao!.maps;

        const first = pins[0];
        const map = new maps.Map(container, {
          center: new maps.LatLng(first.lat, first.lng),
          level: 5,
        });
        mapRef.current = map;

        const bounds = new maps.LatLngBounds();
        const entries: MarkerEntry[] = [];

        for (const pin of pins) {
          const position = new maps.LatLng(pin.lat, pin.lng);
          const marker = new maps.Marker({ position, title: pin.title });
          marker.setMap(map);
          bounds.extend(position);

          const infoWindow = new maps.InfoWindow({
            content: buildInfoWindowContent(pin),
            removable: false,
            zIndex: 1,
          });

          maps.event.addListener(marker, "click", () => {
            onSelectRef.current?.(pin.id);
          });

          entries.push({ id: pin.id, marker, infoWindow });
        }

        entriesRef.current = entries;

        // 전체 핀 보이게 fit bounds. 핀 1개면 center + level 5 (이미 위에서 center 지정)
        if (pins.length === 1) {
          map.setCenter(new maps.LatLng(first.lat, first.lng));
          map.setLevel(5);
        } else {
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
      // 마커 정리 (컨테이너 재사용 시 잔여 마커 방지)
      for (const entry of entriesRef.current) {
        entry.infoWindow.close();
        entry.marker.setMap(null);
      }
      entriesRef.current = [];
      openInfoWindowRef.current = null;
      mapRef.current = null;
    };
  }, [pinsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- pins는 pinsKey로 내용 비교

  // selectedId 변경 시 해당 InfoWindow 열기/강조 (지도 재생성 없이)
  useEffect(() => {
    if (status !== "ready") return;
    const map = mapRef.current;
    if (!map) return;

    // 이전에 열린 InfoWindow 닫기
    if (openInfoWindowRef.current) {
      openInfoWindowRef.current.close();
      openInfoWindowRef.current = null;
    }

    if (!selectedId) return;

    const entry = entriesRef.current.find((e) => e.id === selectedId);
    if (!entry) return;

    // 선택한 차량의 평창 픽업 위치로 지도를 이동(center) + InfoWindow 강조.
    // → 추천 차량을 고르면 지도의 출발 위치가 그 위치로 바뀐다.
    map.setCenter(entry.marker.getPosition());
    entry.infoWindow.open(map, entry.marker);
    openInfoWindowRef.current = entry.infoWindow;
  }, [selectedId, status, pinsKey]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg bg-muted ${heightClass}`}
      aria-label="지도"
    >
      <div ref={containerRef} className="h-full w-full" />
      {pins.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">
            표시할 위치가 없습니다.
          </span>
        </div>
      )}
      {pins.length > 0 && status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">
            지도 불러오는 중…
          </span>
        </div>
      )}
      {pins.length > 0 && status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">
            지도를 불러올 수 없어요.
          </span>
        </div>
      )}
    </div>
  );
}
