import "server-only";

/**
 * 카카오 REST 주소 검색(지오코딩) — 주소 문자열 → 좌표(lat/lng). SPEC §5.3·§10.1.
 * 출발/도착지 등록(operator profile) 시 서버에서 호출해 region_locations.lat/lng를 채운다.
 * → 학생 지도(/me/trip)에 실제 핀이 찍힘.
 *
 * 실패(키 없음·미발견·HTTP 오류·네트워크)는 모두 null 반환 — 좌표 없이 저장되고
 * 학생 지도는 주소 fallback("지도를 불러올 수 없어요")으로 graceful degrade.
 * REST 키는 서버 전용(NEXT_PUBLIC 아님) — 클라이언트에 노출 금지.
 */
const KAKAO_GEOCODE_URL = "https://dapi.kakao.com/v2/local/search/address.json";

export type Coords = { lat: number; lng: number };

export async function geocodeAddress(address: string): Promise<Coords | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  const query = address.trim();
  if (!key || !query) return null;

  try {
    const res = await fetch(
      `${KAKAO_GEOCODE_URL}?query=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `KakaoAK ${key}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      documents?: Array<{ x: string; y: string }>;
    };
    const doc = data.documents?.[0];
    if (!doc) return null;

    // 카카오: x = 경도(longitude), y = 위도(latitude). 문자열로 옴.
    const lng = Number(doc.x);
    const lat = Number(doc.y);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
