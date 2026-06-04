"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMapSdk } from "@/lib/kakao/load-sdk";

type Props = {
  lat: number;
  lng: number;
  label: string;
};

type Status = "loading" | "ready" | "error";

export function KakaoMap({ lat, lng, label }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
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
        const center = new maps.LatLng(lat, lng);
        const map = new maps.Map(container, { center, level: 4 });
        const marker = new maps.Marker({ position: center });
        marker.setMap(map);

        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [lat, lng]);

  return (
    <div
      className="relative h-60 w-full overflow-hidden rounded-lg bg-muted"
      aria-label={`${label} 지도`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">
            지도 불러오는 중…
          </span>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">
            지도를 불러올 수 없어요.
          </span>
        </div>
      )}
    </div>
  );
}
