// Client-only. Never call from server components or server modules.
// Safe to import — loadKakaoMapSdk() guards with typeof window check before any DOM access.

type KakaoMapsApi = {
  load(callback: () => void): void;
  Map: new (container: HTMLElement, options: object) => object;
  LatLng: new (lat: number, lng: number) => object;
  Marker: new (options: { position: object }) => { setMap(map: object): void };
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
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
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
