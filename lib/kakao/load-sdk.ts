// Client-only. Never call from server components or server modules.
// Safe to import — loadKakaoMapSdk() guards with typeof window check before any DOM access.

// SDK 객체 인스턴스 타입 (생성자 반환값) — 외부에서 핸들로 다룰 때 사용
export type KakaoLatLng = object;

export type KakaoMap = {
  setBounds(bounds: KakaoLatLngBounds): void;
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
};

export type KakaoMarker = {
  setMap(map: KakaoMap | null): void;
  getPosition(): KakaoLatLng;
};

export type KakaoLatLngBounds = {
  extend(latlng: KakaoLatLng): void;
  isEmpty(): boolean;
};

export type KakaoInfoWindow = {
  open(map: KakaoMap, marker: KakaoMarker): void;
  close(): void;
};

// Kakao Places(키워드 검색) — libraries=services 로드 시 사용 가능.
// KakaoSearchPicker(방식 B)에서 장소 검색 결과(주소·좌표)를 얻는다.
export type KakaoPlacesResult = {
  id: string;
  place_name: string;
  address_name: string; // 지번 주소
  road_address_name: string; // 도로명 주소 (없으면 "")
  x: string; // 경도(lng)
  y: string; // 위도(lat)
};

export type KakaoPlacesStatus = "OK" | "ZERO_RESULT" | "ERROR";

export type KakaoPlaces = {
  keywordSearch(
    keyword: string,
    callback: (data: KakaoPlacesResult[], status: KakaoPlacesStatus) => void,
    options?: { location?: KakaoLatLng; radius?: number },
  ): void;
};

type KakaoMapsApi = {
  load(callback: () => void): void;
  Map: new (container: HTMLElement, options: object) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Marker: new (options: { position: KakaoLatLng; title?: string }) => KakaoMarker;
  LatLngBounds: new () => KakaoLatLngBounds;
  InfoWindow: new (options: {
    content: string | HTMLElement;
    removable?: boolean;
    zIndex?: number;
  }) => KakaoInfoWindow;
  event: {
    addListener(
      target: KakaoMap | KakaoMarker,
      type: string,
      handler: () => void,
    ): void;
  };
  // libraries=services 로 로드된 경우에만 존재. KakaoSearchPicker에서 존재 여부를 가드.
  services?: {
    Places: new () => KakaoPlaces;
    Status: { OK: "OK"; ZERO_RESULT: "ZERO_RESULT"; ERROR: "ERROR" };
  };
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}

let sdkPromise: Promise<void> | null = null;
const SDK_TIMEOUT_MS = 8000;

export function loadKakaoMapSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("server"));
  }

  // Map 생성자가 실제로 존재하는 경우만 초기화 완료로 간주
  // autoload=false 환경에서 window.kakao.maps는 load() 콜백 전에도 존재하므로
  // maps.Map (생성자)를 기준으로 판단
  if (typeof window.kakao?.maps?.Map === "function") {
    return Promise.resolve();
  }

  // 진행 중인 로딩 있으면 재사용 (중복 script 삽입 방지)
  if (sdkPromise) return sdkPromise;

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("key_missing"));
  }

  sdkPromise = new Promise<void>((resolve, reject) => {
    let settled = false;

    // script 삽입 시점부터 8초 내에 kakao.maps.load 콜백이 오지 않으면 reject
    // 미등록 도메인 등으로 kakao.maps.load callback이 silent hang하는 경우 대응
    const timerId = setTimeout(() => {
      if (settled) return;
      settled = true;
      sdkPromise = null; // 다음 호출 시 재시도 가능하도록 초기화
      reject(new Error("timeout"));
    }, SDK_TIMEOUT_MS);

    const script = document.createElement("script");
    // libraries=services: Places 키워드 검색(방식 B, KakaoSearchPicker)에 필요.
    // 추가만 함 — 기존 지도/마커 로딩에는 영향 없음(services는 부가 모듈).
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    script.async = true;

    script.onload = () => {
      if (settled) return;
      window.kakao!.maps.load(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve();
      });
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timerId);
      sdkPromise = null;
      reject(new Error("load_failed"));
    };

    document.head.appendChild(script);
  });

  return sdkPromise;
}
